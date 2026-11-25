import { VERSION } from './version';

export const BFCM_THEMES = [
  'classic',
  'green',
  'amber',
  'turbo',
  'cga',
] as const;

export type BfcmTheme = (typeof BFCM_THEMES)[number];

const BFCM_PAGES: Record<string, string> = {
  h: '/home',
  f: '/features/forge',
  e: '/enterprise',
  g: '/signup',
  t: 'https://resend.studio',
};

const ENTER_SCREEN = '\x1b[?1049h\x1b[?25l';
const RESTORE_SCREEN = '\x1b[0m\x1b[?25h\x1b[?1049l';
const CTRL_C = '\x03';
const ESCAPE = '\x1b';
const RESIZE_DEBOUNCE_MS = 150;
const RESTART_DELAY_MS = 1000;
const ERROR_RETRY_DELAY_MS = 5000;
const MAX_MESSAGE_LENGTH = 500;
const RETRYABLE_STATUSES = new Set([408, 429]);

export type BfcmBoardState = {
  theme: BfcmTheme;
  sound: boolean;
  popup: boolean;
  closed: number;
  boot: boolean;
};

export type BfcmBoardInput = {
  setRawMode(mode: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'data', listener: (data: Buffer | string) => void): unknown;
  off(event: 'data', listener: (data: Buffer | string) => void): unknown;
};

export type BfcmBoardOutput = {
  columns: number;
  rows: number;
  write(chunk: string | Uint8Array): unknown;
  on(event: 'resize', listener: () => void): unknown;
  off(event: 'resize', listener: () => void): unknown;
};

export type BfcmBoardOptions = {
  baseUrl: string;
  theme: BfcmTheme;
  input: BfcmBoardInput;
  output: BfcmBoardOutput;
  getAccessToken: (options: { force: boolean }) => Promise<string>;
  openUrl: (url: string) => void;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  restartDelayMs?: number;
  errorRetryDelayMs?: number;
};

export class BfcmUnauthorizedError extends Error {
  constructor() {
    super(
      'The BFCM board did not accept your login. Run `resend login --web` and try again.',
    );
    this.name = 'BfcmUnauthorizedError';
  }
}

export class BfcmTokenError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'BfcmTokenError';
  }
}

export class BfcmTokenUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Could not refresh your login. Trying again...', { cause });
    this.name = 'BfcmTokenUnavailableError';
  }
}

export class BfcmRequestError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`The BFCM board returned ${status}${detail ? `: ${detail}` : '.'}`);
    this.name = 'BfcmRequestError';
  }
}

export function nextBfcmTheme(theme: BfcmTheme): BfcmTheme {
  const at = BFCM_THEMES.indexOf(theme);
  return BFCM_THEMES[(at + 1) % BFCM_THEMES.length];
}

export function bfcmBoardUrl(
  baseUrl: string,
  state: BfcmBoardState,
  size: { columns: number; rows: number },
): string {
  const url = new URL('/bfcm/live.txt', baseUrl);
  url.search = new URLSearchParams({
    ...(size.columns > 0 && { cols: String(size.columns) }),
    ...(size.rows > 0 && { rows: String(size.rows) }),
    theme: state.theme,
    sound: state.sound ? 'on' : 'off',
    popup: state.popup ? 'on' : 'off',
    closed: String(state.closed),
    boot: state.boot ? 'on' : 'off',
    keys: 'on',
  }).toString();
  return url.toString();
}

function screenMessage(text: string): string {
  return `\x1b[0m\x1b[H\x1b[2J\n  ${text}\n`;
}

async function responseDetail(response: Response): Promise<string> {
  const text = await response.text();
  if (response.headers.get('content-type')?.includes('text/html')) {
    return '';
  }
  return text.trim().slice(0, MAX_MESSAGE_LENGTH);
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || RETRYABLE_STATUSES.has(status);
}

function networkErrorDetail(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    typeof cause.code === 'string'
  ) {
    return cause.code;
  }
  return error instanceof Error ? error.message : String(error);
}

export function runBfcmBoard(options: BfcmBoardOptions): Promise<void> {
  const { baseUrl, input, output, openUrl, signal } = options;
  const fetchBoard = options.fetch ?? fetch;
  const restartDelayMs = options.restartDelayMs ?? RESTART_DELAY_MS;
  const errorRetryDelayMs = options.errorRetryDelayMs ?? ERROR_RETRY_DELAY_MS;
  const state: BfcmBoardState = {
    theme: options.theme,
    sound: false,
    popup: false,
    closed: 0,
    boot: true,
  };

  return new Promise((resolve, reject) => {
    let finished = false;
    let current: AbortController | undefined;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let token: Promise<string> | undefined;

    const fetchToken = (force: boolean): Promise<string> => {
      const pending = options
        .getAccessToken({ force })
        .catch((error: unknown) => {
          if (error instanceof BfcmTokenUnavailableError) {
            if (token === pending) {
              token = undefined;
            }
            throw error;
          }
          throw new BfcmTokenError(error);
        });
      return pending;
    };

    const accessToken = () => {
      token ??= fetchToken(false);
      return token;
    };

    // Refresh tokens rotate, so only the stream that holds the refused token refreshes it.
    const refreshedAccessToken = (rejected: Promise<string>) => {
      if (token === rejected) {
        token = fetchToken(true);
      }
      return token ?? accessToken();
    };

    const request = (accessTokenValue: string, abort: AbortSignal) =>
      fetchBoard(
        bfcmBoardUrl(baseUrl, state, {
          columns: output.columns,
          rows: output.rows,
        }),
        {
          headers: {
            Authorization: `Bearer ${accessTokenValue}`,
            'User-Agent': `resend-cli:${VERSION}`,
          },
          signal: abort,
        },
      );

    const stream = async (abort: AbortSignal): Promise<number> => {
      try {
        const used = accessToken();
        let response = await request(await used, abort);
        if (response.status === 401) {
          await response.body?.cancel();
          response = await request(await refreshedAccessToken(used), abort);
          if (response.status === 401) {
            await response.body?.cancel();
            throw new BfcmUnauthorizedError();
          }
        }
        state.boot = false;
        if (!response.ok || !response.body) {
          const detail = await responseDetail(response);
          if (!isRetryableStatus(response.status) && !response.ok) {
            throw new BfcmRequestError(response.status, detail);
          }
          if (!abort.aborted) {
            output.write(
              screenMessage(
                `${detail || `The BFCM board returned ${response.status}.`} Trying again...`,
              ),
            );
          }
          return errorRetryDelayMs;
        }
        for await (const chunk of response.body) {
          if (abort.aborted) {
            break;
          }
          output.write(chunk);
        }
        return restartDelayMs;
      } catch (error) {
        if (
          abort.aborted ||
          error instanceof BfcmUnauthorizedError ||
          error instanceof BfcmTokenError ||
          error instanceof BfcmRequestError
        ) {
          throw error;
        }
        output.write(
          screenMessage(
            error instanceof BfcmTokenUnavailableError
              ? error.message
              : `Could not reach ${baseUrl} (${networkErrorDetail(error)}). Trying again...`,
          ),
        );
        return errorRetryDelayMs;
      }
    };

    const start = () => {
      if (finished) {
        return;
      }
      clearTimeout(restartTimer);
      current?.abort();
      const controller = new AbortController();
      current = controller;
      stream(controller.signal).then(
        (delay) => {
          if (current === controller && !finished) {
            restartTimer = setTimeout(start, delay);
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            finish(error instanceof Error ? error : new Error(String(error)));
          }
        },
      );
    };

    const onKey = (data: Buffer | string) => {
      const keys = data.toString();
      if (keys.startsWith(ESCAPE)) {
        return;
      }
      for (const key of keys.toLowerCase()) {
        switch (key) {
          case 'q':
          case CTRL_C:
            finish();
            return;
          case 'm':
            state.theme = nextBfcmTheme(state.theme);
            start();
            break;
          case 's':
            state.sound = !state.sound;
            start();
            break;
          case 'r':
            state.popup = !state.popup;
            start();
            break;
          case 'x':
            state.popup = false;
            state.closed = Math.floor(Date.now() / 1000);
            start();
            break;
          default: {
            const page = BFCM_PAGES[key];
            if (page) {
              openUrl(new URL(page, baseUrl).toString());
            }
          }
        }
      }
    };

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(start, RESIZE_DEBOUNCE_MS);
    };

    const onAbort = () => finish();

    function finish(error?: Error) {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(restartTimer);
      clearTimeout(resizeTimer);
      current?.abort();
      input.off('data', onKey);
      output.off('resize', onResize);
      signal?.removeEventListener('abort', onAbort);
      input.setRawMode(false);
      input.pause();
      output.write(RESTORE_SCREEN);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }

    if (signal?.aborted) {
      resolve();
      return;
    }
    signal?.addEventListener('abort', onAbort);
    output.write(ENTER_SCREEN);
    input.setRawMode(true);
    input.resume();
    input.on('data', onKey);
    output.on('resize', onResize);
    start();
  });
}
