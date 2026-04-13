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

const mockForward = vi.fn(async () => ({
  data: { id: 'fwd-email-id' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { receiving: { forward: mockForward } };
  },
}));

describe('emails receiving forward command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockForward.mockClear();
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

  test('calls SDK forward with correct emailId, to, and from', async () => {
    spies = setupOutputSpies();

    const { forwardCommand } = await import(
      '../../../../src/commands/emails/receiving/forward'
    );
    await forwardCommand.parseAsync(
      ['rcv_abc123', '--to', 'user@example.com', '--from', 'you@domain.com'],
      { from: 'user' },
    );

    expect(mockForward).toHaveBeenCalledWith({
      emailId: 'rcv_abc123',
      to: ['user@example.com'],
      from: 'you@domain.com',
    });
  });

  test('outputs JSON object in non-interactive mode', async () => {
    spies = setupOutputSpies();

    const { forwardCommand } = await import(
      '../../../../src/commands/emails/receiving/forward'
    );
    await forwardCommand.parseAsync(
      ['rcv_abc123', '--to', 'user@example.com', '--from', 'you@domain.com'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('fwd-email-id');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { forwardCommand } = await import(
      '../../../../src/commands/emails/receiving/forward'
    );
    await expectExit1(() =>
      forwardCommand.parseAsync(
        ['rcv_abc123', '--to', 'user@example.com', '--from', 'you@domain.com'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockForward.mockResolvedValueOnce(
      mockSdkError('Email not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { forwardCommand } = await import(
      '../../../../src/commands/emails/receiving/forward'
    );
    await expectExit1(() =>
      forwardCommand.parseAsync(
        ['rcv_abc123', '--to', 'user@example.com', '--from', 'you@domain.com'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
