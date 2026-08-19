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

const mockUpdate = vi.fn(async () => ({
  data: { object: 'api_key' as const, id: 'test-key-id' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    apiKeys = { update: mockUpdate };
  },
}));

describe('api-keys update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let commandRef: { parent: unknown } | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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
    if (commandRef) {
      commandRef.parent = null;
      commandRef = undefined;
    }
  });

  it('updates API key with id and --name flag', async () => {
    spies = setupOutputSpies();

    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    await updateApiKeyCommand.parseAsync(
      ['test-key-id', '--name', 'Production v2'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe('test-key-id');
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.name).toBe('Production v2');
  });

  it('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    await updateApiKeyCommand.parseAsync(
      ['test-key-id', '--name', 'Production v2'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('api_key');
    expect(parsed.id).toBe('test-key-id');
  });

  it('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    await expectExit1(() =>
      updateApiKeyCommand.parseAsync(['test-key-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('errors with missing_name when --json is set even in TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { Command } = await import('@commander-js/extra-typings');
    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(updateApiKeyCommand);
    commandRef = updateApiKeyCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(['update', 'test-key-id', '--json'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('does not call SDK when missing_name error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    await expectExit1(() =>
      updateApiKeyCommand.parseAsync(['test-key-id'], { from: 'user' }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    await expectExit1(() =>
      updateApiKeyCommand.parseAsync(
        ['test-key-id', '--name', 'Production v2'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('API key not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateApiKeyCommand } = await import(
      '../../../src/commands/api-keys/update'
    );
    await expectExit1(() =>
      updateApiKeyCommand.parseAsync(
        ['test-key-id', '--name', 'Production v2'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
