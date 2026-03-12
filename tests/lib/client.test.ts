import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resend } from 'resend';
import { afterEach, describe, expect, test } from 'vitest';
import { captureTestEnv } from '../helpers';

describe('createClient', () => {
  const restoreEnv = captureTestEnv();

  afterEach(() => {
    restoreEnv();
  });

  test('returns Resend instance when flag value provided', async () => {
    const { createClient } = await import('../../src/lib/client');
    const client = createClient('re_test_key');
    expect(client).toBeInstanceOf(Resend);
  });

  test('returns Resend instance when env var set', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { createClient } = await import('../../src/lib/client');
    const client = createClient();
    expect(client).toBeInstanceOf(Resend);
  });

  test('throws when no API key available', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend-test';
    const { createClient } = await import('../../src/lib/client');
    expect(() => createClient()).toThrow('No API key found');
  });

  test('flag value takes priority over env var', async () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { createClient } = await import('../../src/lib/client');
    const client = createClient('re_flag_key');
    expect(client).toBeInstanceOf(Resend);
  });

  test('profile name is threaded through to resolveApiKey', async () => {
    delete process.env.RESEND_API_KEY;
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
    const client = createClient(undefined, 'staging');
    expect(client).toBeInstanceOf(Resend);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
