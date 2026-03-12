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
} from '../../helpers';

const mockSend = vi.fn(async () => ({
  data: { id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { send: mockSend };
  },
}));

describe('broadcasts send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
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

  test('sends broadcast by id', async () => {
    spies = setupOutputSpies();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await sendBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await sendBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
  });

  test('passes --scheduled-at to SDK', async () => {
    spies = setupOutputSpies();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await sendBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--scheduled-at', 'in 1 hour'],
      { from: 'user' },
    );

    const payload = mockSend.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.scheduledAt).toBe('in 1 hour');
  });

  test('does not pass scheduledAt when flag absent', async () => {
    spies = setupOutputSpies();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await sendBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const payload = mockSend.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.scheduledAt).toBeUndefined();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await expectExit1(() =>
      sendBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with send_error when SDK returns an error', async () => {
    setNonInteractive();
    mockSend.mockResolvedValueOnce(
      mockSdkError('Broadcast not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await expectExit1(() =>
      sendBroadcastCommand.parseAsync(
        ['00000000-0000-0000-0000-00000000bad0'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('send_error');
  });
});
