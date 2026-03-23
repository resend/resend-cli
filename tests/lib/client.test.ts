import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resend } from 'resend';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../helpers';

describe('createClient', () => {
  const restoreEnv = captureTestEnv();

  afterEach(() => {
    restoreEnv();
  });

  test('returns Resend instance when flag value provided', async () => {
    // Force file backend so tests don't interact with real OS keychain
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    const { createClient } = await import('../../src/lib/client');
    const client = await createClient('re_test_key');
    expect(client).toBeInstanceOf(Resend);
  });

  test('returns Resend instance when env var set', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    const { createClient } = await import('../../src/lib/client');
    const client = await createClient();
    expect(client).toBeInstanceOf(Resend);
  });

  test('throws when no API key available', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend-test';
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    const { createClient } = await import('../../src/lib/client');
    await expect(createClient()).rejects.toThrow('No API key found');
  });

  test('flag value takes priority over env var', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    const { createClient } = await import('../../src/lib/client');
    const client = await createClient('re_flag_key');
    expect(client).toBeInstanceOf(Resend);
  });

  test('profile name is threaded through to resolveApiKey', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    const tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;

    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'default',
        teams: {
          default: { api_key: 're_default_key' },
          staging: { api_key: 're_staging_key' },
        },
      }),
    );

    const { createClient } = await import('../../src/lib/client');
    // Should not throw — resolves staging team's key
    const client = await createClient(undefined, 'staging');
    expect(client).toBeInstanceOf(Resend);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('requireClient permission check', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    restoreEnv();
    exitSpy?.mockRestore();
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('blocks sending_access key from full_access command', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: {
          default: { api_key: 're_sending_key', permission: 'sending_access' },
        },
      }),
    );

    const spies = setupOutputSpies();
    exitSpy = mockExitThrow();

    const { requireClient } = await import('../../src/lib/client');
    await expectExit1(() => requireClient({ json: true }));

    const output = spies.logSpy.mock.calls[0][0] as string;
    expect(output).toContain('insufficient_permissions');
    expect(output).toContain('full access');
  });

  test('allows sending_access key for sending_access command', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: {
          default: { api_key: 're_sending_key', permission: 'sending_access' },
        },
      }),
    );

    const { requireClient } = await import('../../src/lib/client');
    const client = await requireClient({}, { permission: 'sending_access' });
    expect(client).toBeInstanceOf(Resend);
  });

  test('allows full_access key for any command', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: {
          default: { api_key: 're_full_key', permission: 'full_access' },
        },
      }),
    );

    const { requireClient } = await import('../../src/lib/client');
    const client = await requireClient({});
    expect(client).toBeInstanceOf(Resend);
  });

  test('skips permission check when permission is not stored', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_legacy_key' } },
      }),
    );

    const { requireClient } = await import('../../src/lib/client');
    const client = await requireClient({});
    expect(client).toBeInstanceOf(Resend);
  });
});
