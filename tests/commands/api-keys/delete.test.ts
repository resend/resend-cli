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

const mockRemove = vi.fn(async () => ({
  data: {},
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    apiKeys = { remove: mockRemove };
  },
}));

describe('api-keys delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
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

  test('deletes API key with --yes flag', async () => {
    spies = setupOutputSpies();

    const { deleteApiKeyCommand } = await import(
      '../../../src/commands/api-keys/delete'
    );
    await deleteApiKeyCommand.parseAsync(['test-key-id', '--yes'], {
      from: 'user',
    });

    expect(mockRemove).toHaveBeenCalledWith('test-key-id');
  });

  test('outputs synthesized deleted JSON on success', async () => {
    spies = setupOutputSpies();

    const { deleteApiKeyCommand } = await import(
      '../../../src/commands/api-keys/delete'
    );
    await deleteApiKeyCommand.parseAsync(['test-key-id', '--yes'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.deleted).toBe(true);
    expect(parsed.id).toBe('test-key-id');
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteApiKeyCommand } = await import(
      '../../../src/commands/api-keys/delete'
    );
    await expectExit1(() =>
      deleteApiKeyCommand.parseAsync(['test-key-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('does not call SDK when confirmation is required but not given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteApiKeyCommand } = await import(
      '../../../src/commands/api-keys/delete'
    );
    await expectExit1(() =>
      deleteApiKeyCommand.parseAsync(['test-key-id'], { from: 'user' }),
    );

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteApiKeyCommand } = await import(
      '../../../src/commands/api-keys/delete'
    );
    await expectExit1(() =>
      deleteApiKeyCommand.parseAsync(['test-key-id', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('API key not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteApiKeyCommand } = await import(
      '../../../src/commands/api-keys/delete'
    );
    await expectExit1(() =>
      deleteApiKeyCommand.parseAsync(['test-key-id', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
