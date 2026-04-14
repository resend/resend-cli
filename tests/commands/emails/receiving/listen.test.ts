import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'rcv_abc123',
        to: ['inbox@yourdomain.com'],
        from: 'sender@external.com',
        subject: 'Hello from outside',
        created_at: '2026-02-18T12:00:00.000Z',
        message_id: '<hello@external.com>',
        bcc: null,
        cc: null,
        reply_to: null,
        attachments: [],
      },
    ],
  },
  error: null,
}));

const defaultMockResponse = () =>
  Promise.resolve({
    data: {
      object: 'list' as const,
      has_more: false,
      data: [
        {
          id: 'rcv_abc123',
          to: ['inbox@yourdomain.com'],
          from: 'sender@external.com',
          subject: 'Hello from outside',
          created_at: '2026-02-18T12:00:00.000Z',
          message_id: '<hello@external.com>',
          bcc: null,
          cc: null,
          reply_to: null,
          attachments: [],
        },
      ],
    },
    error: null,
  });

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { receiving: { list: mockList } };
  },
}));

const makeEmail = (id: string, subject = `Subject ${id}`) => ({
  id,
  to: ['inbox@yourdomain.com'],
  from: 'sender@external.com',
  subject,
  created_at: '2026-02-18T12:00:00.000Z',
  message_id: `<${id}@external.com>`,
  bcc: null,
  cc: null,
  reply_to: null,
  attachments: [],
});

const flushMicrotasks = async () => {
  for (const _ of Array(20)) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

describe('emails receiving listen command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockReset();
    mockList.mockImplementation(defaultMockResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  it('errors with invalid_interval for interval below 2', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );
    await expectExit1(() =>
      listenReceivingCommand.parseAsync(['--interval', '1'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_interval');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );
    await expectExit1(() =>
      listenReceivingCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Server error', 'server_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );
    await expectExit1(() =>
      listenReceivingCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });

  it('initial fetch calls SDK with correct limit', async () => {
    vi.useFakeTimers();
    setupOutputSpies();

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    await vi.advanceTimersByTimeAsync(0);

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(1);
  });

  it('paginates through multiple pages and stops at seen email', async () => {
    vi.useFakeTimers();
    const { logSpy } = setupOutputSpies();

    mockList
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('seen_1')],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: true,
          data: [makeEmail('new_2'), makeEmail('new_1')],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('seen_1')],
        },
        error: null,
      });

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    expect(mockList).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('new_1');
    expect(output).toContain('new_2');
  });

  it('caps pages per poll at MAX_PAGES_PER_POLL', async () => {
    vi.useFakeTimers();
    setupOutputSpies();

    const makePage = (pageNum: number) => ({
      data: {
        object: 'list' as const,
        has_more: true,
        data: Array.from({ length: 100 }, (_, i) =>
          makeEmail(`p${pageNum}_${i}`),
        ),
      },
      error: null,
    });

    mockList
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('initial_seen')],
        },
        error: null,
      })
      .mockResolvedValueOnce(makePage(1))
      .mockResolvedValueOnce(makePage(2))
      .mockResolvedValueOnce(makePage(3))
      .mockResolvedValueOnce(makePage(4))
      .mockResolvedValueOnce(makePage(5))
      .mockResolvedValueOnce(makePage(6))
      .mockResolvedValueOnce(makePage(7));

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    expect(mockList).toHaveBeenCalledTimes(6);
  });

  it('checkpoints progress incrementally on page error mid-poll', async () => {
    vi.useFakeTimers();
    const { logSpy } = setupOutputSpies();

    mockList
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('initial')],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: true,
          data: [makeEmail('page1_email')],
        },
        error: null,
      })
      .mockResolvedValueOnce(mockSdkError('Transient failure', 'server_error'))
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('page1_email')],
        },
        error: null,
      });

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    const firstPollOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(firstPollOutput).toContain('page1_email');

    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    expect(
      logSpy.mock.calls.filter((c) => String(c[0]).includes('page1_email'))
        .length,
    ).toBe(1);
  });

  it('retries rate_limit_exceeded errors with backoff', async () => {
    vi.useFakeTimers();
    setupOutputSpies();

    const rateLimitResponse = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': '1' },
    };

    mockList
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('initial')],
        },
        error: null,
      })
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('initial')],
        },
        error: null,
      });

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();

    expect(mockList).toHaveBeenCalledTimes(3);
  });

  it('displays emails in chronological order (oldest first)', async () => {
    vi.useFakeTimers();
    const { logSpy } = setupOutputSpies();

    mockList
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('seen')],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: true,
          data: [makeEmail('newest'), makeEmail('middle')],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          object: 'list' as const,
          has_more: false,
          data: [makeEmail('oldest'), makeEmail('seen')],
        },
        error: null,
      });

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    const outputs = logSpy.mock.calls.map((c) => String(c[0]));
    const oldestIdx = outputs.findIndex((o) => o.includes('oldest'));
    const newestIdx = outputs.findIndex((o) => o.includes('newest'));
    expect(oldestIdx).toBeGreaterThanOrEqual(0);
    expect(newestIdx).toBeGreaterThanOrEqual(0);
    expect(oldestIdx).toBeLessThan(newestIdx);
  });
});
