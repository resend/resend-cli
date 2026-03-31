import pc from 'picocolors';
import type { GlobalOpts } from './client';
import { errorMessage, outputError } from './output';
import { isInteractive, isUnicodeSupported } from './tty';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const TICK = isUnicodeSupported ? String.fromCodePoint(0x2714) : 'v'; // ✔
const WARN = isUnicodeSupported ? String.fromCodePoint(0x26a0) : '!'; // ⚠
const CROSS = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

// Braille spinner: cycle through U+2800-block dot patterns.
const SPINNER_FRAMES = [
  '\u2839',
  '\u2838',
  '\u2834',
  '\u2826',
  '\u2807',
  '\u280F',
  '\u2819',
  '\u2839',
];
const SPINNER_INTERVAL = 80;

const DEFAULT_RETRY_DELAYS = [1, 2, 4];
const MAX_RETRIES = DEFAULT_RETRY_DELAYS.length;

type SdkResponse<T> = {
  data: T | null;
  error: { message: string; name?: string } | null;
  headers?: Record<string, string> | null;
};

function parseRetryDelay(
  headers?: Record<string, string> | null,
): number | undefined {
  const value = headers?.['retry-after'];
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an SDK call with a loading spinner and unified error handling.
 *
 * The spinner is purely a loading indicator — it clears itself when the call
 * completes. Callers are responsible for printing success output.
 *
 * Automatically retries on rate_limit_exceeded errors (HTTP 429) up to 3 times,
 * using the retry-after header when available or exponential backoff (1s, 2s, 4s).
 */
export async function withSpinner<T>(
  loading: string,
  call: () => Promise<SdkResponse<T>>,
  errorCode: string,
  globalOpts: GlobalOpts,
): Promise<T> {
  const spinner = createSpinner(loading, globalOpts.quiet);
  try {
    for (let attempt = 0; ; attempt++) {
      const { data, error, headers } = await call();
      if (error) {
        if (attempt < MAX_RETRIES && error.name === 'rate_limit_exceeded') {
          const delay =
            parseRetryDelay(headers) ?? DEFAULT_RETRY_DELAYS[attempt];
          spinner.update(`Rate limited, retrying in ${delay}s...`);
          await sleep(delay * 1000);
          spinner.update(loading);
          continue;
        }
        spinner.stop();
        outputError(
          { message: error.message, code: errorCode },
          { json: globalOpts.json },
        );
      }
      if (data === null) {
        spinner.stop();
        outputError(
          { message: 'Unexpected empty response', code: errorCode },
          { json: globalOpts.json },
        );
      }
      spinner.stop();
      return data;
    }
  } catch (err) {
    spinner.stop();
    return outputError(
      { message: errorMessage(err, 'Unknown error'), code: errorCode },
      { json: globalOpts.json },
    );
  }
}

export function createSpinner(message: string, quiet?: boolean) {
  if (quiet || !isInteractive()) {
    return {
      update(_msg: string) {},
      stop(_msg?: string) {},
      clear() {},
      warn(_msg: string) {},
      fail(_msg: string) {},
    };
  }

  const frames = isUnicodeSupported ? SPINNER_FRAMES : ['-', '\\', '|', '/'];
  const interval = SPINNER_INTERVAL;
  let i = 0;
  let text = message;

  const timer = setInterval(() => {
    process.stderr.write(`\r\x1B[2K  ${frames[i++ % frames.length]} ${text}`);
  }, interval);

  return {
    update(msg: string) {
      text = msg;
    },
    stop(msg?: string) {
      clearInterval(timer);
      if (msg) {
        process.stderr.write(`\r\x1B[2K  ${pc.green(TICK)} ${msg}\n`);
      } else {
        process.stderr.write('\r\x1B[2K');
      }
    },
    clear() {
      clearInterval(timer);
      process.stderr.write('\r\x1B[2K');
    },
    warn(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${pc.yellow(WARN)} ${msg}\n`);
    },
    fail(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${pc.red(CROSS)} ${msg}\n`);
    },
  };
}
