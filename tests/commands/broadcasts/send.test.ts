import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockSend = mock(async () => ({
  data: { id: 'bcast_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { send: mockSend };
  },
}));

describe('broadcasts send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
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
    await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toBe('bcast_abc123');
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
  });

  test('passes --scheduled-at to SDK', async () => {
    spies = setupOutputSpies();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await sendBroadcastCommand.parseAsync(
      ['bcast_abc123', '--scheduled-at', 'in 1 hour'],
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
    await sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    const payload = mockSend.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.scheduledAt).toBeUndefined();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await expectExit1(() =>
      sendBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with send_error when SDK returns an error', async () => {
    setNonInteractive();
    mockSend.mockResolvedValueOnce(
      mockSdkError('Broadcast not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { sendBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/send'
    );
    await expectExit1(() =>
      sendBroadcastCommand.parseAsync(['bcast_bad'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('send_error');
  });
});
