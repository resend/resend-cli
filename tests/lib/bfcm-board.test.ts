import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  BfcmRequestError,
  BfcmTokenError,
  BfcmTokenUnavailableError,
  BfcmUnauthorizedError,
  bfcmBoardUrl,
  nextBfcmTheme,
  runBfcmBoard,
} from '../../src/lib/bfcm-board';

const BASE = 'http://bfcm.test';
const RESTORE_SCREEN = '\x1b[0m\x1b[?25h\x1b[?1049l';

class FakeInput extends EventEmitter {
  rawMode = false;
  setRawMode = vi.fn((mode: boolean) => {
    this.rawMode = mode;
  });
  resume = vi.fn();
  pause = vi.fn();
  press(keys: string) {
    this.emit('data', Buffer.from(keys));
  }
}

class FakeOutput extends EventEmitter {
  columns = 120;
  rows = 40;
  text = '';
  write = vi.fn((chunk: string | Uint8Array) => {
    this.text +=
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    return true;
  });
}

type Call = { url: URL; token: string | null; signal?: AbortSignal };
type Handler = (call: Call, index: number) => Response | Promise<Response>;

function boardServer(handle: Handler) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const call = {
      url: new URL(input),
      token: new Headers(init?.headers).get('authorization'),
      signal: init?.signal ?? undefined,
    };
    calls.push(call);
    return handle(call, calls.length - 1);
  });
  return { calls, fetch: fetchMock as unknown as typeof fetch };
}

function openStream(text: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
      },
    }),
    { status: 200 },
  );
}

function setup(
  handle: Handler,
  overrides: {
    getAccessToken?: (o: { force: boolean }) => Promise<string>;
  } = {},
) {
  const input = new FakeInput();
  const output = new FakeOutput();
  const server = boardServer(handle);
  const getAccessToken = vi.fn(
    overrides.getAccessToken ??
      (async ({ force }: { force: boolean }) => (force ? 'fresh' : 'stale')),
  );
  const openUrl = vi.fn();
  const done = runBfcmBoard({
    baseUrl: BASE,
    theme: 'classic',
    input,
    output,
    fetch: server.fetch,
    getAccessToken,
    openUrl,
    restartDelayMs: 5,
    errorRetryDelayMs: 5,
  });
  return { input, output, server, getAccessToken, openUrl, done };
}

describe('bfcmBoardUrl', () => {
  it('sends the board state and terminal size', () => {
    const url = new URL(
      bfcmBoardUrl(
        BASE,
        { theme: 'amber', sound: true, popup: false, closed: 42, boot: true },
        { columns: 100, rows: 30 },
      ),
    );
    expect(url.pathname).toBe('/bfcm/live.txt');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cols: '100',
      rows: '30',
      theme: 'amber',
      sound: 'on',
      popup: 'off',
      closed: '42',
      boot: 'on',
      keys: 'on',
    });
  });

  it('leaves out an unknown terminal size', () => {
    const url = new URL(
      bfcmBoardUrl(
        BASE,
        {
          theme: 'classic',
          sound: false,
          popup: false,
          closed: 0,
          boot: false,
        },
        { columns: 0, rows: 0 },
      ),
    );
    expect(url.searchParams.has('cols')).toBe(false);
    expect(url.searchParams.has('rows')).toBe(false);
  });
});

describe('nextBfcmTheme', () => {
  it('cycles through the themes and wraps around', () => {
    expect(nextBfcmTheme('classic')).toBe('green');
    expect(nextBfcmTheme('cga')).toBe('classic');
  });
});

describe('runBfcmBoard', () => {
  it('streams the board with the access token and restores the terminal on Q', async () => {
    const { input, output, server, done } = setup(() => openStream('FRAME'));

    await vi.waitFor(() => expect(output.text).toContain('FRAME'));
    expect(server.calls[0].token).toBe('Bearer stale');
    expect(input.setRawMode).toHaveBeenCalledWith(true);
    expect(output.text.startsWith('\x1b[?1049h\x1b[?25l')).toBe(true);

    input.press('q');
    await done;

    expect(input.rawMode).toBe(false);
    expect(input.pause).toHaveBeenCalled();
    expect(output.text.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l')).toBe(true);
  });

  it('refreshes the token once on a 401 and retries', async () => {
    const { input, output, server, getAccessToken, done } = setup((call) =>
      call.token === 'Bearer fresh'
        ? openStream('FRAME')
        : new Response('expired', { status: 401 }),
    );

    await vi.waitFor(() => expect(output.text).toContain('FRAME'));
    expect(server.calls.map((c) => c.token)).toEqual([
      'Bearer stale',
      'Bearer fresh',
    ]);
    expect(getAccessToken.mock.calls.map(([o]) => o.force)).toEqual([
      false,
      true,
    ]);

    input.press('q');
    await done;
  });

  it('stops with BfcmUnauthorizedError when the refreshed token is also refused', async () => {
    const { input, output, getAccessToken, done } = setup(
      () => new Response('expired', { status: 401 }),
    );

    await expect(done).rejects.toBeInstanceOf(BfcmUnauthorizedError);
    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(input.rawMode).toBe(false);
    expect(output.text.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l')).toBe(true);
  });

  it('stops when the token cannot be read or refreshed', async () => {
    const { input, output, server, done } = setup(() => openStream('FRAME'), {
      getAccessToken: async () => {
        throw new Error('Token refresh failed (400).');
      },
    });

    const error = await done.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BfcmTokenError);
    expect((error as Error).message).toBe('Token refresh failed (400).');
    expect(server.calls).toHaveLength(0);
    expect(input.rawMode).toBe(false);
    expect(output.text.endsWith(RESTORE_SCREEN)).toBe(true);
  });

  it('wraps a rejection that is not an Error and still stops', async () => {
    const { done } = setup(() => openStream('FRAME'), {
      getAccessToken: () => Promise.reject('keychain locked'),
    });

    await expect(done).rejects.toBeInstanceOf(BfcmTokenError);
  });

  it('retries when the refresh is temporarily unavailable', async () => {
    let refreshes = 0;
    const { input, output, server, getAccessToken, done } = setup(
      (call) =>
        call.token === 'Bearer fresh'
          ? openStream('FRAME')
          : new Response('expired', { status: 401 }),
      {
        getAccessToken: async ({ force }) => {
          if (!force) {
            return 'stale';
          }
          refreshes += 1;
          if (refreshes === 1) {
            throw new BfcmTokenUnavailableError(new Error('503'));
          }
          return 'fresh';
        },
      },
    );

    await vi.waitFor(() => expect(output.text).toContain('FRAME'));
    expect(output.text).toContain('Could not refresh your login');
    expect(getAccessToken.mock.calls.map(([o]) => o.force)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    expect(server.calls.at(-1)?.token).toBe('Bearer fresh');

    input.press('q');
    await done;
  });

  it('refreshes only once when two streams are refused with the same token', async () => {
    const pending: Array<() => void> = [];
    const { input, output, getAccessToken, server, done } = setup((call) => {
      if (call.token === 'Bearer fresh') {
        return openStream('FRAME');
      }
      return new Promise<Response>((resolve) => {
        pending.push(() => resolve(new Response('expired', { status: 401 })));
      });
    });

    await vi.waitFor(() => expect(pending).toHaveLength(1));
    input.press('m');
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    for (const release of pending) {
      release();
    }

    await vi.waitFor(() => expect(output.text).toContain('FRAME'));
    expect(getAccessToken.mock.calls.filter(([o]) => o.force)).toHaveLength(1);
    expect(server.calls[0].signal?.aborted).toBe(true);

    input.press('q');
    await done;
  });

  it('refreshes again when the refreshed token expires later', async () => {
    let refreshes = 0;
    const accepted = new Set<string>();
    const { input, output, getAccessToken, done } = setup(
      (call) => {
        const token = call.token ?? '';
        if (!accepted.has(token)) {
          return new Response('expired', { status: 401 });
        }
        if (token === 'Bearer fresh1') {
          accepted.delete(token);
        }
        return new Response(`FRAME ${token}`);
      },
      {
        getAccessToken: async ({ force }) => {
          if (!force) {
            return 'stale';
          }
          refreshes += 1;
          accepted.add(`Bearer fresh${refreshes}`);
          return `fresh${refreshes}`;
        },
      },
    );

    await vi.waitFor(() =>
      expect(output.text).toContain('FRAME Bearer fresh2'),
    );
    expect(getAccessToken.mock.calls.map(([o]) => o.force)).toEqual([
      false,
      true,
      true,
    ]);

    input.press('q');
    await done;
  });

  it('reuses the refreshed token when the stream restarts', async () => {
    const { input, output, server, getAccessToken, done } = setup((call) =>
      call.token === 'Bearer fresh'
        ? openStream('FRAME')
        : new Response('expired', { status: 401 }),
    );
    await vi.waitFor(() => expect(output.text).toContain('FRAME'));

    input.press('s');
    await vi.waitFor(() => expect(server.calls).toHaveLength(3));
    expect(server.calls[2].token).toBe('Bearer fresh');
    expect(getAccessToken).toHaveBeenCalledTimes(2);

    input.press('q');
    await done;
  });

  it('stops on a status that a retry cannot fix', async () => {
    const { input, done } = setup(
      () =>
        new Response('<html>Not found</html>', {
          status: 404,
          headers: { 'content-type': 'text/html' },
        }),
    );

    const error = await done.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BfcmRequestError);
    expect((error as BfcmRequestError).status).toBe(404);
    expect((error as Error).message).toBe('The BFCM board returned 404.');
    expect(input.rawMode).toBe(false);
  });

  it('restarts the stream with the new state on key presses', async () => {
    const { input, server, done } = setup(() => openStream('FRAME'));
    await vi.waitFor(() => expect(server.calls).toHaveLength(1));
    expect(server.calls[0].url.searchParams.get('boot')).toBe('on');

    input.press('m');
    await vi.waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls[1].url.searchParams.get('theme')).toBe('green');
    expect(server.calls[1].url.searchParams.get('boot')).toBe('off');

    input.press('S');
    await vi.waitFor(() => expect(server.calls).toHaveLength(3));
    expect(server.calls[2].url.searchParams.get('sound')).toBe('on');

    input.press('r');
    await vi.waitFor(() => expect(server.calls).toHaveLength(4));
    expect(server.calls[3].url.searchParams.get('popup')).toBe('on');

    input.press('x');
    await vi.waitFor(() => expect(server.calls).toHaveLength(5));
    expect(server.calls[4].url.searchParams.get('popup')).toBe('off');
    expect(
      Number(server.calls[4].url.searchParams.get('closed')),
    ).toBeGreaterThan(0);

    input.press('q');
    await done;
  });

  it('opens pages without restarting the stream', async () => {
    const { input, server, openUrl, done } = setup(() => openStream('FRAME'));
    await vi.waitFor(() => expect(server.calls).toHaveLength(1));

    input.press('h');
    input.press('T');
    input.press('\x1bOH');

    expect(openUrl.mock.calls).toEqual([
      [`${BASE}/home`],
      ['https://resend.studio/'],
    ]);
    expect(server.calls).toHaveLength(1);

    input.press('q');
    await done;
  });

  it('restarts the stream with the new size on resize', async () => {
    const { input, output, server, done } = setup(() => openStream('FRAME'));
    await vi.waitFor(() => expect(server.calls).toHaveLength(1));

    output.columns = 80;
    output.rows = 24;
    output.emit('resize');

    await vi.waitFor(() => expect(server.calls).toHaveLength(2));
    expect(server.calls[1].url.searchParams.get('cols')).toBe('80');
    expect(server.calls[1].url.searchParams.get('rows')).toBe('24');

    input.press('q');
    await done;
  });

  it('starts a new stream when the server ends one', async () => {
    const { input, server, done } = setup(
      (_call, index) =>
        new Response(index === 0 ? 'Run it again for more' : 'FRAME'),
    );

    await vi.waitFor(() =>
      expect(server.calls.length).toBeGreaterThanOrEqual(2),
    );

    input.press('q');
    await done;
  });

  it('shows the error and retries when the board is unavailable', async () => {
    const { input, output, server, done } = setup((_call, index) =>
      index === 0
        ? new Response('The BFCM board is unavailable right now.\n', {
            status: 503,
          })
        : openStream('FRAME'),
    );

    await vi.waitFor(() => expect(output.text).toContain('FRAME'));
    expect(output.text).toContain(
      'The BFCM board is unavailable right now. Trying again...',
    );
    expect(server.calls).toHaveLength(2);

    input.press('q');
    await done;
  });

  it('retries when the board cannot be reached', async () => {
    const { input, output, done } = setup((_call, index) => {
      if (index === 0) {
        throw new TypeError('fetch failed', {
          cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }),
        });
      }
      return openStream('FRAME');
    });

    await vi.waitFor(() => expect(output.text).toContain('FRAME'));
    expect(output.text).toContain(`Could not reach ${BASE} (ECONNREFUSED)`);

    input.press('q');
    await done;
  });

  it('quits on Ctrl+C', async () => {
    const { input, server, done } = setup(() => openStream('FRAME'));
    await vi.waitFor(() => expect(server.calls).toHaveLength(1));

    input.press('\x03');
    await done;
    expect(input.rawMode).toBe(false);
  });

  it('stops and restores the terminal when the signal aborts', async () => {
    const input = new FakeInput();
    const output = new FakeOutput();
    const stop = new AbortController();
    const server = boardServer(() => openStream('FRAME'));
    const done = runBfcmBoard({
      baseUrl: BASE,
      theme: 'classic',
      input,
      output,
      fetch: server.fetch,
      getAccessToken: async () => 'stale',
      openUrl: vi.fn(),
      signal: stop.signal,
    });
    await vi.waitFor(() => expect(output.text).toContain('FRAME'));

    stop.abort();
    await done;

    expect(input.rawMode).toBe(false);
    expect(output.text.endsWith('\x1b[0m\x1b[?25h\x1b[?1049l')).toBe(true);
  });
});
