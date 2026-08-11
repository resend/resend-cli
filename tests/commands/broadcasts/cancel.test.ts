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
} from '../../helpers';

const mockCancel = vi.fn(async () => ({
  data: { object: 'broadcast', id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { cancel: mockCancel };
  },
}));

describe('broadcasts cancel command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCancel.mockClear();
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

  it('cancels broadcast by id', async () => {
    spies = setupOutputSpies();

    const { cancelBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/cancel'
    );
    await cancelBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
  });

  it('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { cancelBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/cancel'
    );
    await cancelBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(parsed.object).toBe('broadcast');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { cancelBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/cancel'
    );
    await expectExit1(() =>
      cancelBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with cancel_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCancel.mockResolvedValueOnce(
      mockSdkError(
        'Only queued or scheduled broadcasts can be canceled',
        'validation_error',
      ),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { cancelBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/cancel'
    );
    await expectExit1(() =>
      cancelBroadcastCommand.parseAsync(
        ['00000000-0000-0000-0000-00000000bad0'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('cancel_error');
  });
});
