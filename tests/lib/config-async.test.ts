import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTestEnv } from '../helpers';

describe('resolveAuthentication', () => {
  const restoreEnv = captureTestEnv();
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
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns flag value without touching backend', async () => {
    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication('re_flag_key');
    expect(result).toEqual({
      type: 'api_key',
      key: 're_flag_key',
      source: 'flag',
    });
  });

  it('returns env value without touching backend', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication();
    expect(result).toEqual({
      type: 'api_key',
      key: 're_env_key',
      source: 'env',
    });
  });

  it('reads from file when storage is not secure_storage', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_file_key' } },
      }),
    );

    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication();
    expect(result).toEqual({
      type: 'api_key',
      key: 're_file_key',
      source: 'config',
      profile: 'default',
    });
  });

  it('reads from credential backend when storage is secure_storage', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue('re_keychain_key'),
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

    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication();
    expect(result).toEqual({
      type: 'api_key',
      key: 're_keychain_key',
      source: 'secure_storage',
      profile: 'default',
    });
    expect(mockBackend.get).toHaveBeenCalledWith('resend-cli', 'default');
  });

  it('falls back to file api_key when secure storage has no entry but file does', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: { api_key: 're_unmigrated_key' } },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue(null),
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

    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication();
    expect(result).toEqual({
      type: 'api_key',
      key: 're_unmigrated_key',
      source: 'config',
      profile: 'default',
    });
  });

  it('returns null when secure storage has no entry', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue(null),
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

    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication();
    expect(result).toBeNull();
  });

  it('returns null for a profile not in credentials.json even when secure storage has a stale entry', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue('re_stale_key'),
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

    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication(undefined, 'removed-profile');
    expect(result).toBeNull();
    expect(mockBackend.get).not.toHaveBeenCalled();
  });

  it('throws on empty --api-key flag instead of falling back to env', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { resolveAuthentication } = await import('../../src/lib/config');
    await expect(resolveAuthentication('')).rejects.toThrow(
      '--api-key is set but empty',
    );
  });

  it('throws on empty RESEND_API_KEY instead of falling back to stored credentials', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_file_key' } },
      }),
    );
    process.env.RESEND_API_KEY = '';

    const { resolveAuthentication } = await import('../../src/lib/config');
    await expect(resolveAuthentication()).rejects.toThrow(
      'RESEND_API_KEY is set but empty',
    );
  });

  it('throws on empty profile name instead of resolving the active profile', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_file_key' } },
      }),
    );

    const { resolveAuthentication } = await import('../../src/lib/config');
    await expect(resolveAuthentication(undefined, '')).rejects.toThrow(
      '--profile is set but empty',
    );
  });

  it('throws on empty RESEND_PROFILE instead of resolving the active profile', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_file_key' } },
      }),
    );
    process.env.RESEND_PROFILE = '';

    const { resolveAuthentication } = await import('../../src/lib/config');
    await expect(resolveAuthentication()).rejects.toThrow(
      'RESEND_PROFILE is set but empty',
    );
  });

  it('uses flag key without consulting an empty RESEND_API_KEY', async () => {
    process.env.RESEND_API_KEY = '';
    const { resolveAuthentication } = await import('../../src/lib/config');
    const result = await resolveAuthentication('re_flag_key');
    expect(result).toEqual({
      type: 'api_key',
      key: 're_flag_key',
      source: 'flag',
    });
  });
});

describe('storeApiKeyAsync', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('stores key in file backend when secure storage unavailable', async () => {
    vi.resetModules();
    vi.doUnmock('../../src/lib/credential-store');
    const { storeApiKeyAsync } = await import('../../src/lib/config');
    const { configPath, backend } = await storeApiKeyAsync('re_test_key');
    expect(configPath).toContain('credentials.json');
    expect(backend.isSecure).toBe(false);
  });
});

describe('storeOAuthGrant', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  const grant = {
    access_token: 'header.body.sig',
    access_token_expires_at: 9999999999,
    refresh_token: 'rt_secret',
    scope: 'full_access',
  };

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_PROFILE;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    // doMock registrations persist across tests; clear the one used below so it
    // can't poison later suites.
    vi.doUnmock('../../src/lib/write-file-atomic');
  });

  it('writes the full grant inline when no secure backend is available', async () => {
    vi.resetModules();
    vi.doUnmock('../../src/lib/credential-store');
    const { storeOAuthGrant, readCredentials, resolveAuthentication } =
      await import('../../src/lib/config');

    const { configPath, backend } = await storeOAuthGrant(grant, 'staging');
    expect(configPath).toContain('credentials.json');
    expect(backend.isSecure).toBe(false);

    const creds = readCredentials();
    expect(creds?.profiles.staging).toEqual({ type: 'oauth_grant', ...grant });

    const resolved = await resolveAuthentication(undefined, 'staging', {
      refresh: false,
    });
    expect(resolved).toEqual({
      type: 'oauth_grant',
      access_token: grant.access_token,
      profile: 'staging',
      scope: grant.scope,
      source: 'config',
    });
  });

  it('stores secrets in the keychain and only metadata in the file when secure', async () => {
    const store = new Map<string, string>();
    const mockBackend = {
      get: vi.fn(async (_s: string, a: string) => store.get(a) ?? null),
      set: vi.fn(async (_s: string, a: string, v: string) => {
        store.set(a, v);
      }),
      delete: vi.fn(async (_s: string, a: string) => store.delete(a)),
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

    const { storeOAuthGrant, readCredentials, resolveAuthentication } =
      await import('../../src/lib/config');

    const { backend } = await storeOAuthGrant(grant, 'staging');
    expect(backend.isSecure).toBe(true);
    expect(backend.name).toBe('mock-backend');

    // File holds only non-secret metadata; no tokens.
    const creds = readCredentials();
    expect(creds?.storage).toBe('secure_storage');
    expect(creds?.profiles.staging).toEqual({
      type: 'oauth_grant',
      scope: 'full_access',
    });
    expect(mockBackend.set).toHaveBeenCalledWith(
      'resend-cli',
      'staging',
      JSON.stringify(grant),
    );

    // The grant round-trips back out of the keychain blob.
    const resolved = await resolveAuthentication(undefined, 'staging', {
      refresh: false,
    });
    expect(resolved).toEqual({
      type: 'oauth_grant',
      access_token: grant.access_token,
      profile: 'staging',
      scope: grant.scope,
      source: 'secure_storage',
    });
  });

  it('throws when the keychain blob is malformed', async () => {
    const mockBackend = {
      get: vi.fn().mockResolvedValue('not-json'),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'staging',
        storage: 'secure_storage',
        profiles: { staging: { type: 'oauth_grant', scope: 'full_access' } },
      }),
    );

    vi.resetModules();
    vi.doMock('../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    const { resolveAuthentication } = await import('../../src/lib/config');
    await expect(
      resolveAuthentication(undefined, 'staging', { refresh: false }),
    ).rejects.toThrow('Stored OAuth credentials are invalid');
  });

  it('rolls back the keychain secret when the metadata write fails', async () => {
    const mockBackend = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
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
    // Force the credentials-file write to fail after the keychain write lands.
    vi.doMock('../../src/lib/write-file-atomic', () => ({
      writeFileAtomic: vi.fn(() => {
        throw new Error('disk full');
      }),
    }));

    const { storeOAuthGrant } = await import('../../src/lib/config');
    await expect(storeOAuthGrant(grant, 'staging')).rejects.toThrow(
      'disk full',
    );

    // Secret was written, then removed so the keychain and file can't disagree.
    expect(mockBackend.set).toHaveBeenCalledWith(
      'resend-cli',
      'staging',
      JSON.stringify(grant),
    );
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'staging');
  });
});

describe('removeApiKeyAsync', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('calls backend.delete when backend is secure', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, other: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn().mockResolvedValue(true),
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

    const { removeApiKeyAsync } = await import('../../src/lib/config');
    await removeApiKeyAsync('default');
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'default');
  });

  it('skips backend.delete when backend is not secure', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, other: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: false,
    };

    vi.resetModules();
    vi.doMock('../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    const { removeApiKeyAsync, readCredentials } = await import(
      '../../src/lib/config'
    );
    await removeApiKeyAsync('default');
    expect(mockBackend.delete).not.toHaveBeenCalled();
    const creds = readCredentials();
    expect(creds?.profiles.default).toBeUndefined();
    expect(creds?.profiles.other).toBeDefined();
  });

  it('throws when backend.delete returns false', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, other: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn().mockResolvedValue(false),
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

    const { removeApiKeyAsync, readCredentials } = await import(
      '../../src/lib/config'
    );
    await expect(removeApiKeyAsync('default')).rejects.toThrow(
      'Failed to remove API key',
    );
    const creds = readCredentials();
    expect(creds?.profiles.default).toBeDefined();
  });
});

describe('removeAllApiKeysAsync', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('deletes all profiles from secure storage when secure', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, staging: {}, prod: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn().mockResolvedValue(true),
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

    const { removeAllApiKeysAsync } = await import('../../src/lib/config');
    await removeAllApiKeysAsync();
    expect(mockBackend.delete).toHaveBeenCalledTimes(3);
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'default');
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'staging');
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'prod');
  });

  it('skips secure storage deletion when not secure', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, staging: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: false,
    };

    vi.resetModules();
    vi.doMock('../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    const { removeAllApiKeysAsync } = await import('../../src/lib/config');
    await removeAllApiKeysAsync();
    expect(mockBackend.delete).not.toHaveBeenCalled();
  });

  it('throws when any backend.delete returns false', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, staging: {}, prod: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
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

    const { removeAllApiKeysAsync, getCredentialsPath, readCredentials } =
      await import('../../src/lib/config');
    await expect(removeAllApiKeysAsync()).rejects.toThrow(
      'Failed to remove API keys',
    );
    expect(existsSync(getCredentialsPath())).toBe(true);
    // Successfully-deleted profiles should be removed from the file
    // so retries only re-attempt the ones that actually failed.
    const creds = readCredentials();
    expect(creds?.profiles.default).toBeUndefined();
    expect(creds?.profiles.staging).toBeDefined();
    expect(creds?.profiles.prod).toBeUndefined();
  });

  it('removes a corrupted credentials file instead of failing closed', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, 'credentials.json');
    writeFileSync(configPath, '{"truncated');

    const { removeAllApiKeysAsync } = await import('../../src/lib/config');
    const result = await removeAllApiKeysAsync();

    expect(result).toBe(configPath);
    expect(existsSync(configPath)).toBe(false);
  });
});

describe('renameProfileAsync', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('renames in secure storage when secure', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'old-name',
        storage: 'secure_storage',
        profiles: { 'old-name': {} },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue('re_secret_key'),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
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

    const { renameProfileAsync, readCredentials } = await import(
      '../../src/lib/config'
    );
    await renameProfileAsync('old-name', 'new-name');
    expect(mockBackend.get).toHaveBeenCalledWith('resend-cli', 'old-name');
    expect(mockBackend.set).toHaveBeenCalledWith(
      'resend-cli',
      'new-name',
      're_secret_key',
    );
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'old-name');
    const creds = readCredentials();
    expect(creds?.profiles['new-name']).toBeDefined();
    expect(creds?.profiles['old-name']).toBeUndefined();
    expect(creds?.active_profile).toBe('new-name');
  });

  it('skips secure storage when not secure', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'old-name',
        storage: 'secure_storage',
        profiles: { 'old-name': { api_key: 're_file_key' } },
      }),
    );

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: false,
    };

    vi.resetModules();
    vi.doMock('../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    const { renameProfileAsync, readCredentials } = await import(
      '../../src/lib/config'
    );
    await renameProfileAsync('old-name', 'new-name');
    expect(mockBackend.get).not.toHaveBeenCalled();
    expect(mockBackend.set).not.toHaveBeenCalled();
    expect(mockBackend.delete).not.toHaveBeenCalled();
    const creds = readCredentials();
    expect(creds?.profiles['new-name']).toEqual({
      type: 'api_key',
      api_key: 're_file_key',
    });
    expect(creds?.profiles['old-name']).toBeUndefined();
  });

  it('rolls back new entry and throws when old-name delete fails', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'old-name',
        storage: 'secure_storage',
        profiles: { 'old-name': {} },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue('re_secret_key'),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
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

    const { renameProfileAsync, readCredentials } = await import(
      '../../src/lib/config'
    );
    await expect(renameProfileAsync('old-name', 'new-name')).rejects.toThrow(
      'rolled back',
    );
    expect(mockBackend.delete).toHaveBeenCalledTimes(2);
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'old-name');
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'new-name');
    const creds = readCredentials();
    expect(creds?.profiles['old-name']).toBeDefined();
    expect(creds?.profiles['new-name']).toBeUndefined();
  });
});
