import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { captureTestEnv, setupOutputSpies } from '../../helpers';

describe('migrate command', () => {
  const restoreEnv = captureTestEnv();
  let _spies: ReturnType<typeof setupOutputSpies> | undefined;
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
    _spies = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeCreds(profiles: Record<string, string>, storage?: 'keychain') {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    const creds = {
      active_profile: Object.keys(profiles)[0],
      ...(storage ? { storage } : {}),
      profiles: Object.fromEntries(
        Object.entries(profiles).map(([name, key]) => [
          name,
          key ? { api_key: key } : {},
        ]),
      ),
    };
    writeFileSync(
      join(configDir, 'credentials.json'),
      `${JSON.stringify(creds, null, 2)}\n`,
    );
  }

  function readCreds() {
    return JSON.parse(
      readFileSync(join(tmpDir, 'resend', 'credentials.json'), 'utf-8'),
    );
  }

  test('keychain→file: file is written before keychain entries are deleted', async () => {
    writeCreds({ default: '', staging: '' }, 'keychain');

    const callOrder: string[] = [];
    const mockBackend = {
      get: vi.fn().mockImplementation(async (_s: string, account: string) => {
        callOrder.push(`get:${account}`);
        return `re_key_${account}`;
      }),
      set: vi.fn(),
      delete: vi
        .fn()
        .mockImplementation(async (_s: string, account: string) => {
          callOrder.push(`delete:${account}`);
          return true;
        }),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    vi.resetModules();
    vi.doMock('../../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    _spies = setupOutputSpies();

    const { migrateCommand } = await import(
      '../../../src/commands/auth/migrate'
    );
    await migrateCommand.parseAsync(['--insecure'], { from: 'user' });

    // Verify file was written (contains actual keys)
    const creds = readCreds();
    expect(creds.profiles.default.api_key).toBe('re_key_default');
    expect(creds.profiles.staging.api_key).toBe('re_key_staging');
    expect(creds.storage).toBeUndefined();

    // Verify order: all gets happen before any deletes
    const firstDelete = callOrder.findIndex((c) => c.startsWith('delete:'));
    const gets = callOrder.filter((c) => c.startsWith('get:'));
    const lastGetEntry = gets[gets.length - 1] ?? '';
    const lastGet = callOrder.lastIndexOf(lastGetEntry);
    expect(firstDelete).toBeGreaterThan(lastGet);
  });

  test('file→keychain: keys stored in backend, file updated with storage: keychain', async () => {
    writeCreds({ default: 're_default_key', staging: 're_staging_key' });

    const storedKeys: Record<string, string> = {};
    const mockBackend = {
      get: vi.fn(),
      set: vi
        .fn()
        .mockImplementation(
          async (_s: string, account: string, secret: string) => {
            storedKeys[account] = secret;
          },
        ),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    vi.resetModules();
    vi.doMock('../../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    _spies = setupOutputSpies();

    const { migrateCommand } = await import(
      '../../../src/commands/auth/migrate'
    );
    await migrateCommand.parseAsync([], { from: 'user' });

    expect(storedKeys.default).toBe('re_default_key');
    expect(storedKeys.staging).toBe('re_staging_key');

    const creds = readCreds();
    expect(creds.storage).toBe('keychain');
    expect(creds.profiles.default.api_key).toBeUndefined();
    expect(creds.profiles.staging.api_key).toBeUndefined();
  });

  test('already-migrated to file: no-op with success message', async () => {
    writeCreds({ default: 're_key' });

    _spies = setupOutputSpies();

    const { migrateCommand } = await import(
      '../../../src/commands/auth/migrate'
    );
    await migrateCommand.parseAsync(['--insecure'], { from: 'user' });

    // No error, and credentials unchanged
    const creds = readCreds();
    expect(creds.profiles.default.api_key).toBe('re_key');
    expect(creds.storage).toBeUndefined();
  });

  test('file→keychain: migrates only unmigrated profiles in mixed state', async () => {
    // Simulate: storage is 'keychain' but some profiles still have plaintext keys
    writeCreds({ default: 're_plaintext_key', migrated: '' }, 'keychain');

    const storedKeys: Record<string, string> = {};
    const mockBackend = {
      get: vi.fn(),
      set: vi
        .fn()
        .mockImplementation(
          async (_s: string, account: string, secret: string) => {
            storedKeys[account] = secret;
          },
        ),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    vi.resetModules();
    vi.doMock('../../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    _spies = setupOutputSpies();

    const { migrateCommand } = await import(
      '../../../src/commands/auth/migrate'
    );
    await migrateCommand.parseAsync([], { from: 'user' });

    // Only the unmigrated profile should be stored
    expect(storedKeys.default).toBe('re_plaintext_key');
    expect(storedKeys.migrated).toBeUndefined();

    const creds = readCreds();
    expect(creds.storage).toBe('keychain');
    expect(creds.profiles.default.api_key).toBeUndefined();
    expect(creds.profiles.migrated.api_key).toBeUndefined();
  });

  test('already-migrated to keychain: no-op with success message', async () => {
    writeCreds({ default: '' }, 'keychain');

    const mockBackend = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      name: 'mock-backend',
      isSecure: true,
    };

    vi.resetModules();
    vi.doMock('../../../src/lib/credential-store', () => ({
      getCredentialBackend: vi.fn().mockResolvedValue(mockBackend),
      SERVICE_NAME: 'resend-cli',
      resetCredentialBackend: vi.fn(),
    }));

    _spies = setupOutputSpies();

    const { migrateCommand } = await import(
      '../../../src/commands/auth/migrate'
    );
    await migrateCommand.parseAsync([], { from: 'user' });

    // Backend was never called
    expect(mockBackend.set).not.toHaveBeenCalled();
    expect(mockBackend.delete).not.toHaveBeenCalled();
  });
});
