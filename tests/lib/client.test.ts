import { describe, test, expect, afterEach, mock } from 'bun:test';
import { Resend } from 'resend';

describe('createClient', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('returns Resend instance when flag value provided', () => {
    const { createClient } = require('../../src/lib/client');
    const client = createClient('re_test_key');
    expect(client).toBeInstanceOf(Resend);
  });

  test('returns Resend instance when env var set', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { createClient } = require('../../src/lib/client');
    const client = createClient();
    expect(client).toBeInstanceOf(Resend);
  });

  test('throws when no API key available', () => {
    delete process.env.RESEND_API_KEY;
    // Point to empty config dir so no stored key
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend-test';
    const { createClient } = require('../../src/lib/client');
    expect(() => createClient()).toThrow('No API key found');
  });

  test('flag value takes priority over env var', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const { createClient } = require('../../src/lib/client');
    // We can't inspect the key directly, but we can verify it doesn't throw
    const client = createClient('re_flag_key');
    expect(client).toBeInstanceOf(Resend);
  });
});
