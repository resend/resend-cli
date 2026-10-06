import { Command } from '@commander-js/extra-typings';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { captureTestEnv, setupOutputSpies } from '../../../helpers';

const makeEmail = (number: number) => ({
  id: `email-${number}`,
  to: ['inbox@example.com'],
  from: 'sender@example.com',
  subject: `Email ${number}`,
  created_at: '2026-10-06 12:00:00+00',
  message_id: `<email-${number}@example.com>`,
  bcc: null,
  cc: null,
  reply_to: null,
  attachments: [],
});

type Email = ReturnType<typeof makeEmail>;
type Request = { limit: number; after: string | null };
type Failure = 'http' | 'network' | 'malformed' | 'empty' | 'rate_limit';

describe('receiving listener pagination with the real SDK', () => {
  const restoreEnv = captureTestEnv();
  let inbox: Email[];
  let requests: Request[];
  let unexpectedRequests: string[];
  let failure: Failure | undefined;
  let failureCursor: string | undefined;
  let logSpy: MockInstance;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    process.env.RESEND_BASE_URL = 'https://receiving.fixture.invalid';
    inbox = [makeEmail(0), makeEmail(-1), makeEmail(-2)];
    requests = [];
    unexpectedRequests = [];
    failure = undefined;
    failureCursor = undefined;
    ({ logSpy } = setupOutputSpies());
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Keep SDK URL construction, response parsing and error handling real.
    vi.stubGlobal('fetch', async (input: string | URL | RequestInfo) => {
      const url = new URL(String(input));
      if (
        url.origin !== 'https://receiving.fixture.invalid' ||
        url.pathname !== '/emails/receiving'
      ) {
        unexpectedRequests.push(String(input));
        throw new Error('Unexpected fixture request');
      }
      const limit = Number(url.searchParams.get('limit'));
      const after = url.searchParams.get('after');
      requests.push({ limit, after });

      if (failure && after === failureCursor) {
        const currentFailure = failure;
        failure = undefined;
        if (currentFailure === 'network') {
          throw new TypeError('Fixture connection interrupted');
        }
        if (currentFailure === 'malformed') {
          return Response.json({
            object: 'list',
            has_more: true,
            data: [null],
          });
        }
        if (currentFailure === 'empty') {
          return Response.json({ object: 'list', has_more: true, data: [] });
        }
        if (currentFailure === 'rate_limit') {
          return Response.json(
            { name: 'rate_limit_exceeded', message: 'Fixture rate limit' },
            { status: 429, headers: { 'retry-after': '0' } },
          );
        }
        return Response.json(
          { name: 'internal_server_error', message: 'Fixture page failure' },
          { status: 500 },
        );
      }

      const cursorIndex = after
        ? inbox.findIndex((email) => email.id === after)
        : -1;
      if (after && cursorIndex === -1) {
        unexpectedRequests.push(`Unknown cursor: ${after}`);
        throw new Error('Unknown fixture cursor');
      }
      const offset = after ? cursorIndex + 1 : 0;
      return Response.json({
        object: 'list',
        has_more: offset + limit < inbox.length,
        data: inbox.slice(offset, offset + limit),
      });
    });
  });

  afterEach(() => {
    expect(unexpectedRequests).toEqual([]);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    restoreEnv();
  });

  const flush = async () => {
    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(0);
    }
  };

  const start = async () => {
    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );
    const program = new Command()
      .option('--api-key <key>')
      .option('--json')
      .addCommand(listenReceivingCommand);
    void program.parseAsync(
      ['--api-key', 're_fixture_only', '--json', 'listen'],
      { from: 'user' },
    );
    await flush();
    expect(requests).toEqual([{ limit: 1, after: null }]);
  };

  const arrive = (count: number) => {
    inbox = [
      ...Array.from({ length: count }, (_, i) => makeEmail(count - i)),
      ...inbox,
    ];
  };

  const tick = async () => {
    const before = requests.length;
    await vi.advanceTimersByTimeAsync(5000);
    await flush();
    return requests.slice(before);
  };

  const emittedIds = (): string[] =>
    logSpy.mock.calls
      .map(([line]) => JSON.parse(String(line)) as { id?: string })
      .flatMap((entry) => (entry.id ? [entry.id] : []));

  it.each([
    101, 500,
  ])('displays a healthy %i-email range once', async (count) => {
    await start();
    arrive(count);
    await tick();
    await tick();

    const ids = emittedIds();
    expect(ids).toHaveLength(count);
    expect(new Set(ids).size).toBe(count);
    expect(ids[0]).toBe('email-1');
    expect(ids.at(-1)).toBe(`email-${count}`);
    expect(ids).not.toContain('email-0');
  });

  it.each([
    501, 1201, 10501,
  ])('resumes capped pages until all %i new emails are displayed once', async (count) => {
    await start();
    arrive(count);
    for (let i = 0; i < Math.ceil(count / 500); i++) {
      const pageRequests = await tick();
      expect(pageRequests.length).toBeLessThanOrEqual(5);
    }
    await tick();

    const ids = emittedIds();
    expect(ids).toHaveLength(count);
    expect(new Set(ids).size).toBe(count);
    expect(ids).toContain('email-1');
    expect(ids).toContain(`email-${count}`);
    expect(ids).not.toContain('email-0');
    expect(ids).not.toContain('email--1');
    expect(ids).not.toContain('email--2');
  });

  it.each([
    'http',
    'network',
    'malformed',
  ] as const)('recovers the unfinished page after a %s failure', async (kind) => {
    await start();
    arrive(101);
    failure = kind;
    failureCursor = 'email-2';
    await tick();
    expect(emittedIds()).toHaveLength(100);
    await tick();
    await tick();

    const ids = emittedIds();
    expect(ids).toHaveLength(101);
    expect(new Set(ids).size).toBe(101);
    expect(ids).toContain('email-1');
    expect(ids).not.toContain('email-0');
  });

  it('returns to the head for arrivals made while the backlog is draining', async () => {
    await start();
    arrive(501);
    await tick();
    inbox.unshift(makeEmail(503), makeEmail(502));
    await tick();
    await tick();
    await tick();

    const ids = emittedIds();
    expect(ids).toHaveLength(503);
    expect(new Set(ids).size).toBe(503);
    expect(ids).toContain('email-1');
    expect(ids.slice(-2)).toEqual(['email-502', 'email-503']);
    expect(ids).not.toContain('email-0');
  });

  it('retries an empty continuation page without returning to the head', async () => {
    await start();
    arrive(501);
    await tick();
    failure = 'empty';
    failureCursor = 'email-2';
    await tick();
    await tick();
    await tick();

    const ids = emittedIds();
    expect(ids).toHaveLength(501);
    expect(new Set(ids).size).toBe(501);
    expect(ids).toContain('email-1');
    expect(ids).not.toContain('email-0');
  });

  it('keeps rate-limit retry behavior during a multi-page poll', async () => {
    await start();
    arrive(101);
    failure = 'rate_limit';
    failureCursor = 'email-2';
    await tick();
    await tick();

    const ids = emittedIds();
    expect(ids).toHaveLength(101);
    expect(new Set(ids).size).toBe(101);
    expect(ids[0]).toBe('email-1');
    expect(ids.at(-1)).toBe('email-101');
  });
});
