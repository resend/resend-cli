import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import { captureTestEnv } from '../helpers';

describe('resolveApiKeyAsync', () => {
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
    delete process.env.RESEND_TEAM;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  test('returns flag value without touching backend', async () => {
    const { resolveApiKeyAsync } = await import('../../src/lib/config');
    const result = await resolveApiKeyAsync('re_flag_key');
    expect(result).toEqual({ key: 're_flag_key', source: 'flag' });
  });

  test('returns env value without touching backend', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { resolveApiKeyAsync } = await import('../../src/lib/config');
    const result = await resolveApiKeyAsync();
    expect(result).toEqual({ key: 're_env_key', source: 'env' });
  });

  test('reads from file when storage is not keychain', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_file_key' } },
      }),
    );

    const { resolveApiKeyAsync } = await import('../../src/lib/config');
    const result = await resolveApiKeyAsync();
    expect(result).toEqual({
      key: 're_file_key',
      source: 'config',
      profile: 'default',
    });
  });

  test('reads from credential backend when storage is keychain', async () => {
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

    const { resolveApiKeyAsync } = await import('../../src/lib/config');
    const result = await resolveApiKeyAsync();
    expect(result).toEqual({
      key: 're_keychain_key',
      source: 'secure_storage',
      profile: 'default',
    });
    expect(mockBackend.get).toHaveBeenCalledWith('resend-cli', 'default');
  });

  test('falls back to file api_key when keychain has no entry but file does (mixed state)', async () => {
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

    const { resolveApiKeyAsync } = await import('../../src/lib/config');
    const result = await resolveApiKeyAsync();
    expect(result).toEqual({
      key: 're_unmigrated_key',
      source: 'config',
      profile: 'default',
    });
  });

  test('returns null when keychain has no entry', async () => {
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

    const { resolveApiKeyAsync } = await import('../../src/lib/config');
    const result = await resolveApiKeyAsync();
    expect(result).toBeNull();
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

  test('stores key in file backend when keychain unavailable', async () => {
    vi.resetModules();
    vi.doUnmock('../../src/lib/credential-store');
    const { storeApiKeyAsync } = await import('../../src/lib/config');
    const { configPath, backend } = await storeApiKeyAsync('re_test_key');
    expect(configPath).toContain('credentials.json');
    expect(backend.isSecure).toBe(false);
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

  test('calls backend.delete when backend is secure', async () => {
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
      delete: vi.fn().mockResolvedValue(undefined),
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

  test('skips backend.delete when backend is not secure', async () => {
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

  test('deletes all profiles from keychain when secure', async () => {
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
      delete: vi.fn().mockResolvedValue(undefined),
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

  test('skips keychain deletion when not secure', async () => {
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

  test('renames in keychain when secure', async () => {
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
      delete: vi.fn().mockResolvedValue(undefined),
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

  test('skips keychain when not secure', async () => {
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
    expect(creds?.profiles['new-name']).toEqual({ api_key: 're_file_key' });
    expect(creds?.profiles['old-name']).toBeUndefined();
  });
});

describe('writeCredentials atomic write', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not leave a temp file on success', async () => {
    vi.resetModules();
    const { writeCredentials, getCredentialsPath } = await import(
      '../../src/lib/config'
    );
    writeCredentials({
      active_profile: 'default',
      profiles: { default: {} },
    });
    const configDir = join(tmpDir, 'resend');
    const files = require('node:fs').readdirSync(configDir);
    const tmpFiles = files.filter((f: string) => f.includes('.tmp.'));
    expect(tmpFiles).toEqual([]);
    expect(existsSync(getCredentialsPath())).toBe(true);
  });

  it('preserves existing file when write fails', async () => {
    vi.resetModules();
    const { writeCredentials, readCredentials } = await import(
      '../../src/lib/config'
    );
    writeCredentials({
      active_profile: 'default',
      profiles: { default: { api_key: 're_original' } },
    });

    const configDir = join(tmpDir, 'resend');
    chmodSync(configDir, 0o555);
    try {
      expect(() =>
        writeCredentials({
          active_profile: 'default',
          profiles: { default: { api_key: 're_new' } },
        }),
      ).toThrow();
    } finally {
      chmodSync(configDir, 0o700);
    }

    const creds = readCredentials();
    expect(creds?.profiles.default?.api_key).toBe('re_original');
  });
});

describe('storeApiKeyAsync rollback', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('rolls back backend.set when writeCredentials fails', async () => {
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

    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true, mode: 0o700 });

    const { storeApiKeyAsync } = await import('../../src/lib/config');
    chmodSync(configDir, 0o555);
    try {
      await expect(storeApiKeyAsync('re_new_key', 'default')).rejects.toThrow();
      expect(mockBackend.set).toHaveBeenCalledWith(
        'resend-cli',
        'default',
        're_new_key',
      );
      expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'default');
    } finally {
      chmodSync(configDir, 0o700);
    }
  });
});

describe('removeApiKeyAsync rollback', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('restores backend secret when file removal fails', async () => {
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
      get: vi.fn().mockResolvedValue('re_saved_key'),
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

    const { removeApiKeyAsync } = await import('../../src/lib/config');
    chmodSync(configDir, 0o555);
    try {
      await expect(removeApiKeyAsync('default')).rejects.toThrow();
      expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'default');
      expect(mockBackend.set).toHaveBeenCalledWith(
        'resend-cli',
        'default',
        're_saved_key',
      );
    } finally {
      chmodSync(configDir, 0o700);
    }
  });
});

describe('removeAllApiKeysAsync rollback', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('restores all backend secrets when file unlink fails', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    const credsPath = join(configDir, 'credentials.json');
    writeFileSync(
      credsPath,
      JSON.stringify({
        active_profile: 'default',
        storage: 'secure_storage',
        profiles: { default: {}, staging: {} },
      }),
    );

    const secrets: Record<string, string> = {
      default: 're_default_key',
      staging: 're_staging_key',
    };

    const mockBackend = {
      get: vi.fn((_, account: string) =>
        Promise.resolve(secrets[account] ?? null),
      ),
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

    const { removeAllApiKeysAsync } = await import('../../src/lib/config');
    chmodSync(configDir, 0o555);
    try {
      await expect(removeAllApiKeysAsync()).rejects.toThrow();
      expect(mockBackend.delete).toHaveBeenCalledTimes(2);
      expect(mockBackend.set).toHaveBeenCalledWith(
        'resend-cli',
        'default',
        're_default_key',
      );
      expect(mockBackend.set).toHaveBeenCalledWith(
        'resend-cli',
        'staging',
        're_staging_key',
      );
    } finally {
      chmodSync(configDir, 0o700);
    }
  });
});

describe('renameProfileAsync rollback', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('rolls back backend.set(newName) when file rename fails', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'alpha',
        storage: 'secure_storage',
        profiles: { alpha: {}, beta: {} },
      }),
    );

    const mockBackend = {
      get: vi.fn().mockResolvedValue('re_alpha_key'),
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
    await expect(renameProfileAsync('alpha', 'beta')).rejects.toThrow(
      'already exists',
    );
    expect(mockBackend.set).toHaveBeenCalledWith(
      'resend-cli',
      'beta',
      're_alpha_key',
    );
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'beta');
    const creds = readCredentials();
    expect(creds?.profiles.alpha).toBeDefined();
    expect(creds?.active_profile).toBe('alpha');
  });

  it('does not delete old backend key until file rename succeeds', async () => {
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
      get: vi.fn().mockResolvedValue('re_the_key'),
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
    expect(mockBackend.set).toHaveBeenCalledWith(
      'resend-cli',
      'new-name',
      're_the_key',
    );
    const deleteCallOrder = mockBackend.delete.mock.invocationCallOrder[0];
    const setCallOrder = mockBackend.set.mock.invocationCallOrder[0];
    expect(deleteCallOrder).toBeGreaterThan(setCallOrder);
    expect(mockBackend.delete).toHaveBeenCalledWith('resend-cli', 'old-name');
    const creds = readCredentials();
    expect(creds?.profiles['new-name']).toBeDefined();
    expect(creds?.profiles['old-name']).toBeUndefined();
  });
});
