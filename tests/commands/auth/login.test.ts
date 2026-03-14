import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// Mock the Resend SDK
const mockDomainsList = vi.fn(async () => ({
  data: { data: [] },
  error: null,
}));
vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { list: mockDomainsList };
  },
}));

describe('login command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(async () => {
    restoreEnv();
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    try {
      const { loginCommand } = await import('../../../src/commands/auth/login');
      (loginCommand as { parent?: unknown }).parent = null;
    } catch {
      // ignore if module not loaded
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('exits with validation_failed when API rejects the key', async () => {
    mockDomainsList.mockRejectedValueOnce(new Error('Invalid API key'));
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 're_valid_format_but_invalid_key'], {
        from: 'user',
      }),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('validation_failed');
  });

  test('rejects key not starting with re_ with invalid_key_format', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 'bad_key'], { from: 'user' }),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('invalid_key_format');
  });

  test('rejects empty or whitespace-only key with missing_key in non-interactive', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', '   '], { from: 'user' }),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('missing_key');
  });

  test('trims API key before storing', async () => {
    setupOutputSpies();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', '  re_trimmed_key_456  '], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_trimmed_key_456');
  });

  test('stores valid key to credentials.json and sets active_profile', async () => {
    setupOutputSpies();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', 're_valid_test_key_123'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_valid_test_key_123');
    expect(data.active_profile).toBe('default');
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

  test('non-interactive login stores as default when no --profile (does not switch active)', async () => {
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
    expect(data.profiles.default.api_key).toBe('re_new_key_5678');
    expect(data.profiles.production.api_key).toBe('re_old_key_1234');
    // Original behavior: no --profile means we store to default but do not switch active
    expect(data.active_profile).toBe('production');
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

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('legacy');
    expect(data.profiles.legacy.api_key).toBe('re_team_alias_key_123');
  });

  test('rejects invalid profile name with invalid_profile_name', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { Command } = await import('@commander-js/extra-typings');
    const { loginCommand } = await import('../../../src/commands/auth/login');
    const program = new Command()
      .option('--profile <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    await expectExit1(() =>
      program.parseAsync(
        ['login', '--key', 're_valid_123', '--profile', 'invalid name!'],
        { from: 'user' },
      ),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('invalid_profile_name');
  });

  test('trims --profile before storing', async () => {
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
      ['login', '--key', 're_trim_profile_key', '--profile', '  myprofile  '],
      { from: 'user' },
    );

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.myprofile).toBeDefined();
    expect(data.profiles.myprofile.api_key).toBe('re_trim_profile_key');
    expect(data.active_profile).toBe('myprofile');
  });

  test('--json output includes success, config_path, and profile', async () => {
    setupOutputSpies();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { Command } = await import('@commander-js/extra-typings');
    const { loginCommand } = await import('../../../src/commands/auth/login');
    const program = new Command()
      .option('--profile <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    await program.parseAsync(
      ['login', '--key', 're_json_output_key', '--profile', 'prod', '--json'],
      { from: 'user' },
    );

    expect(logSpy).toHaveBeenCalled();
    const out = logSpy.mock.calls.flat().join('\n');
    const parsed = JSON.parse(out);
    expect(parsed.success).toBe(true);
    expect(parsed.config_path).toBeDefined();
    expect(parsed.profile).toBe('prod');
  });

  test('exits with write_failed when credentials file cannot be written', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    vi.resetModules();
    const configMod = await import('../../../src/lib/config');
    const storeSpy = vi
      .spyOn(configMod, 'storeApiKey')
      .mockImplementationOnce(() => {
        throw new Error('EACCES: permission denied');
      });

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 're_valid_key_123'], {
        from: 'user',
      }),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('write_failed');

    storeSpy.mockRestore();
  });
});
