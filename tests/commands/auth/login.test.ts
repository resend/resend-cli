import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { loginCommand } from '../../../src/commands/auth/login';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

// Mock the Resend SDK – default: valid key; override via mockDomainListResult
let mockDomainListResult: { data: unknown; error: unknown } = {
  data: { data: [] },
  error: null,
};

const oauthMocks = vi.hoisted(() => ({
  createCallbackServer: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
}));

vi.mock('../../../src/lib/oauth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/lib/oauth')>()),
  generatePKCE: () => ({
    codeVerifier: 'test_verifier',
    codeChallenge: 'test_challenge',
    state: 'test_state',
  }),
  createCallbackServer: oauthMocks.createCallbackServer,
  exchangeAuthorizationCode: oauthMocks.exchangeAuthorizationCode,
}));

vi.mock('../../../src/lib/browser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/lib/browser')>()),
  openInBrowser: vi.fn(async () => false),
}));

function fakeJwt(exp: number): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`;
}

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
    oauthMocks.createCallbackServer.mockReset().mockResolvedValue({
      port: 4321,
      waitForCallback: Promise.resolve({
        code: 'test_code',
        state: 'test_state',
      }),
    });
    oauthMocks.exchangeAuthorizationCode.mockReset().mockResolvedValue({
      access_token: fakeJwt(2_000_000_000),
      refresh_token: 'test_refresh_token',
      scope: 'full_access',
    });
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    // Force file backend so tests don't interact with real OS keychain
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(async () => {
    restoreEnv();
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    try {
      (loginCommand as { parent?: unknown }).parent = null;
    } catch {
      // ignore if module not loaded
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects key that fails API validation', async () => {
    mockDomainListResult = {
      data: null,
      error: {
        statusCode: 400,
        message: 'API key is invalid',
        name: 'validation_error',
      },
    };

    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

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

  it('rejects key not starting with re_', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 'bad_key'], { from: 'user' }),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('invalid_key_format');
  });

  it('rejects empty or whitespace-only key with missing_key in non-interactive', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      loginCommand.parseAsync(['--key', '   '], { from: 'user' }),
    );

    const output = errorSpy?.mock.calls.flat().join(' ') ?? '';
    expect(output).toContain('missing_key');
  });

  it('trims API key before storing', async () => {
    setNonInteractive();

    await loginCommand.parseAsync(['--key', '  re_trimmed_key_456  '], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_trimmed_key_456');
  });

  it('stores valid key to credentials.json and sets active_profile', async () => {
    setupOutputSpies();

    await loginCommand.parseAsync(['--key', 're_valid_test_key_123'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_valid_test_key_123');
    expect(data.active_profile).toBe('default');
  });

  it('requires --key in non-interactive mode', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() => loginCommand.parseAsync([], { from: 'user' }));

    expect(errorSpy).toBeDefined();
    const output = errorSpy?.mock.calls[0][0] as string;
    expect(output).toContain('missing_key');
    expect(output).toContain('resend login --web');
  });

  it('--web logs in through the browser without a TTY', async () => {
    setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await loginCommand.parseAsync(['--web'], { from: 'user' });

    const stderr = errorSpy.mock.calls.flat().join('\n');
    expect(stderr).toContain('/oauth/authorize?');
    expect(stderr).toContain(
      'redirect_uri=http%3A%2F%2F127.0.0.1%3A4321%2Foauth%2Fcallback',
    );
    expect(oauthMocks.exchangeAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'test_code',
        codeVerifier: 'test_verifier',
      }),
    );

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default).toMatchObject({
      type: 'oauth_grant',
      refresh_token: 'test_refresh_token',
      scope: 'full_access',
      access_token_expires_at: 2_000_000_000,
    });
  });

  it('--web --json keeps the URL on stderr and only JSON on stdout', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command()
      .option('--profile <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    await program.parseAsync(['login', '--web', '--json'], { from: 'user' });

    expect(errorSpy.mock.calls.flat().join('\n')).toContain(
      '/oauth/authorize?',
    );
    const parsed = JSON.parse(logSpy.mock.calls.flat().join('\n'));
    expect(parsed).toMatchObject({
      success: true,
      profile: 'default',
      scope: 'full_access',
    });
  });

  it('rejects --web with --key', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      loginCommand.parseAsync(['--web', '--key', 're_abc'], { from: 'user' }),
    );

    expect(errorSpy.mock.calls.flat().join(' ')).toContain('conflicting_flags');
    expect(oauthMocks.createCallbackServer).not.toHaveBeenCalled();
  });

  it('errors with missing_key when --json is set but --key is omitted even in TTY', async () => {
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

    loginCommand.parent = null;
  });

  it('non-interactive login stores as default when profiles exist', async () => {
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

  it('auto-switches to profile specified via --profile flag', async () => {
    setupOutputSpies();

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

  it('rejects invalid profile name with invalid_profile_name', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

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

  it('trims --profile before storing', async () => {
    setupOutputSpies();

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

  it('--json output includes success, config_path, and profile', async () => {
    setupOutputSpies();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

  it('accepts sending-only key and stores permission', async () => {
    mockDomainListResult = {
      data: null,
      error: {
        statusCode: 401,
        message: 'This API key is restricted to only send emails',
        name: 'restricted_api_key',
      },
    };

    setupOutputSpies();

    await loginCommand.parseAsync(['--key', 're_sending_only_key_123'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_sending_only_key_123');
    expect(data.profiles.default.permission).toBe('sending_access');
  });

  it('stores full_access permission for valid full access key', async () => {
    setupOutputSpies();

    await loginCommand.parseAsync(['--key', 're_full_access_key_123'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_full_access_key_123');
    expect(data.profiles.default.permission).toBe('full_access');
  });

  it('--json output includes permission for sending-only key', async () => {
    mockDomainListResult = {
      data: null,
      error: {
        statusCode: 401,
        message: 'This API key is restricted to only send emails',
        name: 'restricted_api_key',
      },
    };

    setupOutputSpies();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command()
      .option('--profile <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    await program.parseAsync(
      ['login', '--key', 're_sending_key', '--profile', 'ci', '--json'],
      { from: 'user' },
    );

    const out = logSpy.mock.calls.flat().join('\n');
    const parsed = JSON.parse(out);
    expect(parsed.success).toBe(true);
    expect(parsed.permission).toBe('sending_access');
  });
});
