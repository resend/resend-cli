import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
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

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { receiving: { list: mockList } };
  },
}));

describe('emails receiving listen command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
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

  test('errors with invalid_interval for interval below 2', async () => {
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

  test('errors with auth_error when no API key', async () => {
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

  test('errors with list_error when SDK returns an error', async () => {
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

  test('initial fetch calls SDK with correct limit', async () => {
    vi.useFakeTimers();
    setupOutputSpies();

    const { listenReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/listen'
    );

    listenReceivingCommand.parseAsync([], { from: 'user' }).catch(() => {});
    // Flush microtasks so the initial SDK call resolves
    await vi.advanceTimersByTimeAsync(0);

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(1);
  });
});
