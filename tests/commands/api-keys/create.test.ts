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

const mockCreate = vi.fn(async () => ({
  data: { id: 'test-key-id', token: 're_testtoken1234567890' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    apiKeys = { create: mockCreate };
  },
}));

describe('api-keys create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let commandRef: { parent: unknown } | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
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

  it('creates API key with --name flag', async () => {
    spies = setupOutputSpies();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await createApiKeyCommand.parseAsync(['--name', 'Production'], {
      from: 'user',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.name).toBe('Production');
  });

  it('passes permission flag to SDK', async () => {
    spies = setupOutputSpies();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await createApiKeyCommand.parseAsync(
      ['--name', 'CI Token', '--permission', 'sending_access'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.permission).toBe('sending_access');
  });

  it('passes domain_id (snake_case) to SDK when --domain-id is provided', async () => {
    spies = setupOutputSpies();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await createApiKeyCommand.parseAsync(
      [
        '--name',
        'Domain Token',
        '--permission',
        'sending_access',
        '--domain-id',
        'domain-123',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.domain_id).toBe('domain-123');
  });

  it('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await createApiKeyCommand.parseAsync(['--name', 'Production'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-key-id');
    expect(parsed.token).toBe('re_testtoken1234567890');
  });

  it('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync([], { from: 'user' }),
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
    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(createApiKeyCommand);
    commandRef = createApiKeyCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(['create', '--json'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('does not call SDK when missing_name error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync([], { from: 'user' }),
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync(['--name', 'Production'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Name already taken', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync(['--name', 'Production'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });

  it('errors with invalid_flags when --domain-id is used without --permission sending_access', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync(
        ['--name', 'CI Token', '--domain-id', 'domain-123'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_flags');
    expect(output).toContain(
      '--domain-id requires --permission sending_access',
    );
  });

  it('errors with invalid_flags when --domain-id is used with --permission full_access', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync(
        [
          '--name',
          'CI Token',
          '--permission',
          'full_access',
          '--domain-id',
          'domain-123',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_flags');
  });

  it('does not call SDK when --domain-id is used without sending_access', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await expectExit1(() =>
      createApiKeyCommand.parseAsync(
        ['--name', 'CI Token', '--domain-id', 'domain-123'],
        { from: 'user' },
      ),
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('allows --domain-id with --permission sending_access', async () => {
    spies = setupOutputSpies();

    const { createApiKeyCommand } = await import(
      '../../../src/commands/api-keys/create'
    );
    await createApiKeyCommand.parseAsync(
      [
        '--name',
        'Domain Token',
        '--permission',
        'sending_access',
        '--domain-id',
        'domain-123',
      ],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.domain_id).toBe('domain-123');
    expect(args.permission).toBe('sending_access');
  });
});
