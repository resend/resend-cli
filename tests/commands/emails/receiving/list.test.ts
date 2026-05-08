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
        to: ['inbox@example.com'],
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

describe('emails receiving list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  it('calls SDK list with default pagination', async () => {
    spies = setupOutputSpies();

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await listReceivingCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(10);
  });

  it('passes --limit to pagination options', async () => {
    spies = setupOutputSpies();

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await listReceivingCommand.parseAsync(['--limit', '5'], { from: 'user' });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(5);
  });

  it('passes --after cursor to pagination options', async () => {
    spies = setupOutputSpies();

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await listReceivingCommand.parseAsync(['--after', 'rcv_cursor123'], {
      from: 'user',
    });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.after).toBe('rcv_cursor123');
  });

  it('outputs JSON list with received email data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await listReceivingCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].id).toBe('rcv_abc123');
    expect(parsed.data[0].from).toBe('sender@external.com');
    expect(parsed.data[0].subject).toBe('Hello from outside');
    expect(parsed.has_more).toBe(false);
  });

  it('errors with invalid_limit for out-of-range limit', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await expectExit1(() =>
      listReceivingCommand.parseAsync(['--limit', '200'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await expectExit1(() =>
      listReceivingCommand.parseAsync([], { from: 'user' }),
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

    const { listReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/list'
    );
    await expectExit1(() =>
      listReceivingCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
