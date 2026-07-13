import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  setupOutputSpies,
} from '../helpers';

describe('whoami command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
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
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_PROFILE;
  });

  afterEach(() => {
    restoreEnv();
    spies = undefined;
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 1 with structured error when not authenticated (non-interactive)', async () => {
    spies = setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await expectExit1(() => whoamiCommand.parseAsync([], { from: 'user' }));

    const output = String(errorSpy.mock.calls[0]?.[0] ?? '');
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe('not_authenticated');
    expect(parsed.error.message).toContain('Not authenticated');
  });

  it('exits 1 with profile_not_found error for missing profile (non-interactive)', async () => {
    process.env.RESEND_PROFILE = 'nonexistent';
    spies = setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await expectExit1(() => whoamiCommand.parseAsync([], { from: 'user' }));

    const output = String(errorSpy.mock.calls[0]?.[0] ?? '');
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe('profile_not_found');
    expect(parsed.error.message).toContain('not found');
  });

  it('errors on empty RESEND_PROFILE instead of falling back to the active profile', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'production',
        profiles: { production: { api_key: 're_test_key_abcd' } },
      }),
    );
    process.env.RESEND_PROFILE = '';

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await expect(
      whoamiCommand.parseAsync([], { from: 'user' }),
    ).rejects.toThrow('RESEND_PROFILE is set but empty');
  });

  it('errors on empty RESEND_API_KEY instead of falling back to stored credentials', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'production',
        profiles: { production: { api_key: 're_test_key_abcd' } },
      }),
    );
    process.env.RESEND_API_KEY = '';

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await expect(
      whoamiCommand.parseAsync([], { from: 'user' }),
    ).rejects.toThrow('RESEND_API_KEY is set but empty');
  });

  it('shows authenticated JSON when key exists in config', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'production',
        profiles: { production: { api_key: 're_test_key_abcd' } },
      }),
    );

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.profile).toBe('production');
    expect(parsed.api_key).toBe('re_...abcd');
    expect(parsed.source).toBe('config');
    expect(parsed.config_path).toBe(join(tmpDir, 'resend', 'credentials.json'));
  });

  it('shows an OAuth grant without making any network call', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    const nowSeconds = Math.floor(Date.now() / 1000);
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'staging',
        profiles: {
          staging: {
            type: 'oauth_grant',
            access_token: 'header.body.abcd',
            access_token_expires_at: nowSeconds + 900,
            refresh_token: 'rt_secret',
            scope: 'full_access',
          },
        },
      }),
    );

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network should not be called'));

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.profile).toBe('staging');
    expect(parsed.api_key).toBe('hea...abcd');
    expect(parsed.source).toBe('config');
    // whoami is documented as local-only: it must not refresh the token.
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('reports secure_storage source for a keychain OAuth grant', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    const nowSeconds = Math.floor(Date.now() / 1000);
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'staging',
        storage: 'secure_storage',
        profiles: { staging: { type: 'oauth_grant', scope: 'full_access' } },
      }),
    );

    const grant = {
      access_token: 'header.body.abcd',
      access_token_expires_at: nowSeconds + 900,
      refresh_token: 'rt_secret',
      scope: 'full_access',
    };
    const mockBackend = {
      get: vi.fn().mockResolvedValue(JSON.stringify(grant)),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    vi.resetModules();
    vi.doMock('../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network should not be called'));

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.source).toBe('secure_storage');
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('shows env source when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_env_key_5678';

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.source).toBe('env');
    expect(parsed.config_path).toBe(join(tmpDir, 'resend', 'credentials.json'));
  });

  it('shows authenticated for keychain user (async resolve)', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: { api_key: '' } },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue('re_keychain_test_key1'),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    vi.resetModules();
    vi.doMock('../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.api_key).toBe('re_...key1');
    expect(parsed.source).toBe('secure_storage');
    expect(parsed.config_path).toBe(join(tmpDir, 'resend', 'credentials.json'));
  });

  it('shows permission in JSON output when stored', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: {
          default: {
            api_key: 're_sending_key_abcd',
            permission: 'sending_access',
          },
        },
      }),
    );

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.permission).toBe('sending_access');
  });

  it('omits permission from JSON when not stored', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_legacy_key_abcd' } },
      }),
    );

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.permission).toBeUndefined();
  });
});
