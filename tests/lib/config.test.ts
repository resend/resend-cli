import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getConfigDir, resolveApiKey, storeApiKey } from '../../src/lib/config';

describe('getConfigDir', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('respects XDG_CONFIG_HOME', () => {
    process.env.XDG_CONFIG_HOME = '/custom/config';
    expect(getConfigDir()).toBe('/custom/config/resend');
  });

  test('falls back to ~/.config/resend on non-Windows', () => {
    delete process.env.XDG_CONFIG_HOME;
    const dir = getConfigDir();
    expect(dir).toMatch(/\.config\/resend$/);
  });
});

describe('resolveApiKey', () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('flag value takes highest priority', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const result = resolveApiKey('re_flag_key');
    expect(result).toEqual({ key: 're_flag_key', source: 'flag' });
  });

  test('env var is second priority', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const result = resolveApiKey();
    expect(result).toEqual({ key: 're_env_key', source: 'env' });
  });

  test('config file is third priority', () => {
    delete process.env.RESEND_API_KEY;
    // Point XDG to our temp dir so resolveApiKey reads from there
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(join(configDir, 'credentials.json'), JSON.stringify({ api_key: 're_config_key' }));

    const result = resolveApiKey();
    expect(result).toEqual({ key: 're_config_key', source: 'config' });
  });

  test('returns null when no key found', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir; // empty dir, no credentials
    const result = resolveApiKey();
    expect(result).toBeNull();
  });

  test('returns null on malformed config JSON', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(join(configDir, 'credentials.json'), 'not json');

    const result = resolveApiKey();
    expect(result).toBeNull();
  });

  test('returns null when config exists but api_key is empty', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(join(configDir, 'credentials.json'), JSON.stringify({ api_key: '' }));

    const result = resolveApiKey();
    expect(result).toBeNull();
  });
});

describe('storeApiKey', () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = join(tmpdir(), `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes credentials.json with api_key', () => {
    const configPath = storeApiKey('re_test_key_123');
    expect(configPath).toContain('credentials.json');

    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.api_key).toBe('re_test_key_123');
  });

  test('creates config directory if it does not exist', () => {
    storeApiKey('re_test_key');
    const configDir = join(tmpDir, 'resend');
    const stat = statSync(configDir);
    expect(stat.isDirectory()).toBe(true);
  });

  test('sets file permissions to 0600', () => {
    const configPath = storeApiKey('re_test_key');
    const stat = statSync(configPath);
    // 0o600 = owner rw only (on unix). Bitmask with 0o777 to get permission bits.
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test('overwrites existing credentials', () => {
    storeApiKey('re_first_key');
    storeApiKey('re_second_key');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.api_key).toBe('re_second_key');
  });
});
