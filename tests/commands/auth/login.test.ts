import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  setupOutputSpies,
} from '../../helpers';

// Mock the Resend SDK – default: valid key; override via mockDomainListResult
let mockDomainListResult: { data: unknown; error: unknown } = {
  data: { data: [] },
  error: null,
};

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = {
      list: vi.fn(async () => mockDomainListResult),
    };
  },
}));

describe('login command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpDir: string;

  beforeEach(() => {
    mockDomainListResult = { data: { data: [] }, error: null };
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    // Force file backend so tests don't interact with real OS keychain
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('rejects key that fails API validation', async () => {
    mockDomainListResult = {
      data: null,
      error: {
        statusCode: 400,
        message: 'API key is invalid',
        name: 'validation_error',
      },
    };

    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 're_fake_invalid_key'], {
        from: 'user',
      }),
    );

    const output = errorSpy?.mock.calls[0][0] as string;
    expect(output).toContain('validation_failed');

    // Credentials file must not be created for an invalid key
    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);
  });

  test('rejects key not starting with re_', async () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 'bad_key'], { from: 'user' }),
    );
  });

  test('stores valid key to credentials.json', async () => {
    setupOutputSpies();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', 're_valid_test_key_123'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_valid_test_key_123');
  });

  test('requires --key in non-interactive mode', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() => loginCommand.parseAsync([], { from: 'user' }));

    expect(errorSpy).toBeDefined();
    const output = errorSpy?.mock.calls[0][0] as string;
    expect(output).toContain('missing_key');
  });

  test('errors with missing_key when --json is set but --key is omitted even in TTY', async () => {
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
    const { loginCommand } = await import('../../../src/commands/auth/login');
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    await expectExit1(() =>
      program.parseAsync(['login', '--json'], { from: 'user' }),
    );

    const raw = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
    expect(raw).toContain('missing_key');

    // @ts-expect-error — reset parent to avoid polluting the shared singleton
    loginCommand.parent = null;
  });

  test('non-interactive login stores as default when profiles exist', async () => {
    // Pre-populate credentials with an existing profile
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'production',
        profiles: { production: { api_key: 're_old_key_1234' } },
      }),
    );

    setupOutputSpies();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', 're_new_key_5678'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    // Non-interactive without --profile flag stores as 'default' (no picker)
    expect(data.profiles.default.api_key).toBe('re_new_key_5678');
    // Original profile should still exist
    expect(data.profiles.production.api_key).toBe('re_old_key_1234');
  });

  test('auto-switches to profile specified via --profile flag', async () => {
    setupOutputSpies();

    const { Command } = await import('@commander-js/extra-typings');
    const { loginCommand } = await import('../../../src/commands/auth/login');
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    // First store a default key
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_old_key_1234' } },
      }),
    );

    await program.parseAsync(
      ['login', '--key', 're_staging_key_123', '--profile', 'staging'],
      { from: 'user' },
    );

    // @ts-expect-error — reset parent to avoid polluting the shared singleton
    loginCommand.parent = null;

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('staging');
    expect(data.profiles.staging.api_key).toBe('re_staging_key_123');
  });

  test('deprecated --team alias works like --profile', async () => {
    setupOutputSpies();

    const { Command } = await import('@commander-js/extra-typings');
    const { loginCommand } = await import('../../../src/commands/auth/login');
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    await program.parseAsync(
      ['login', '--key', 're_team_alias_key_123', '--team', 'legacy'],
      { from: 'user' },
    );

    // @ts-expect-error — reset parent to avoid polluting the shared singleton
    loginCommand.parent = null;

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('legacy');
    expect(data.profiles.legacy.api_key).toBe('re_team_alias_key_123');
  });
});
