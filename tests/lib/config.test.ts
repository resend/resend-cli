import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getConfigDir,
  listProfiles,
  removeApiKey,
  renameProfile,
  resolveApiKey,
  resolveProfileName,
  setActiveProfile,
  storeApiKey,
  validateProfileName,
  writeCredentials,
} from '../../src/lib/config';
import { captureTestEnv } from '../helpers';

describe('getConfigDir', () => {
  const restoreEnv = captureTestEnv();

  afterEach(() => {
    restoreEnv();
  });

  it('respects XDG_CONFIG_HOME', () => {
    process.env.XDG_CONFIG_HOME = '/custom/config';
    expect(getConfigDir()).toBe('/custom/config/resend');
  });

  it('falls back to ~/.config/resend on non-Windows', () => {
    delete process.env.XDG_CONFIG_HOME;
    const dir = getConfigDir();
    expect(dir).toMatch(/\.config\/resend$/);
  });
});

describe('resolveApiKey', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('flag value takes highest priority', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const result = resolveApiKey('re_flag_key');
    expect(result).toEqual({ key: 're_flag_key', source: 'flag' });
  });

  it('env var is second priority', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    const result = resolveApiKey();
    expect(result).toEqual({ key: 're_env_key', source: 'env' });
  });

  it('config file is third priority (new format)', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_config_key' } },
      }),
    );

    const result = resolveApiKey();
    expect(result).toEqual({
      key: 're_config_key',
      source: 'config',
      profile: 'default',
    });
  });

  it('resolves specific profile from config', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: {
          default: { api_key: 're_default' },
          staging: { api_key: 're_staging' },
        },
      }),
    );

    const result = resolveApiKey(undefined, 'staging');
    expect(result).toEqual({
      key: 're_staging',
      source: 'config',
      profile: 'staging',
    });
  });

  it('returns null when no key found', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const result = resolveApiKey();
    expect(result).toBeNull();
  });

  it('returns null on malformed config JSON', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'credentials.json'), 'not json');

    const result = resolveApiKey();
    expect(result).toBeNull();
  });

  it('returns null when profile does not exist in config', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'default',
        profiles: { default: { api_key: 're_default' } },
      }),
    );

    const result = resolveApiKey(undefined, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('resolveProfileName', () => {
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

  it('flag value takes highest priority', () => {
    process.env.RESEND_PROFILE = 'env_profile';
    expect(resolveProfileName('flag_profile')).toBe('flag_profile');
  });

  it('RESEND_PROFILE env var is second priority', () => {
    process.env.RESEND_PROFILE = 'env_profile';
    expect(resolveProfileName()).toBe('env_profile');
  });

  it('active_profile from config is third priority', () => {
    delete process.env.RESEND_PROFILE;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'production',
        profiles: { production: { api_key: 're_xxx' } },
      }),
    );

    expect(resolveProfileName()).toBe('production');
  });

  it('defaults to "default" when nothing configured', () => {
    delete process.env.RESEND_PROFILE;
    expect(resolveProfileName()).toBe('default');
  });
});

describe('storeApiKey', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes credentials.json with profile structure', () => {
    const configPath = storeApiKey('re_test_key_123');
    expect(configPath).toContain('credentials.json');

    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('default');
    expect(data.profiles.default.api_key).toBe('re_test_key_123');
  });

  it('stores key under specific profile name', () => {
    const configPath = storeApiKey('re_staging_key', 'staging');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.staging.api_key).toBe('re_staging_key');
  });

  it('preserves existing profiles when adding new one', () => {
    storeApiKey('re_default_key');
    storeApiKey('re_staging_key', 'staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_default_key');
    expect(data.profiles.staging.api_key).toBe('re_staging_key');
  });

  it('creates config directory if it does not exist', () => {
    storeApiKey('re_test_key');
    const configDir = join(tmpDir, 'resend');
    const stat = statSync(configDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('sets file permissions to 0600', () => {
    const configPath = storeApiKey('re_test_key');
    const stat = statSync(configPath);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('overwrites existing profile key', () => {
    storeApiKey('re_first_key');
    storeApiKey('re_second_key');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.profiles.default.api_key).toBe('re_second_key');
  });

  it('sets first profile as active', () => {
    storeApiKey('re_first_key', 'myprofile');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('myprofile');
  });
});

describe('listProfiles', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no config', () => {
    expect(listProfiles()).toEqual([]);
  });

  it('returns profiles with active flag', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    const profiles = listProfiles();
    expect(profiles).toEqual([
      { name: 'default', active: true },
      { name: 'staging', active: false },
    ]);
  });
});

describe('setActiveProfile', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('switches active profile', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    setActiveProfile('staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('staging');
  });

  it('throws when profile does not exist', () => {
    storeApiKey('re_default');
    expect(() => setActiveProfile('nonexistent')).toThrow('not found');
  });

  it('throws when no credentials file', () => {
    expect(() => setActiveProfile('any')).toThrow('No credentials file');
  });
});

describe('removeApiKey', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes a profile entry', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    removeApiKey('staging');

    const profiles = listProfiles();
    expect(profiles).toEqual([{ name: 'default', active: true }]);
  });

  it('adjusts active_profile when active is removed', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');
    setActiveProfile('staging');

    removeApiKey('staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('default');
  });

  it('deletes file when last profile removed', () => {
    storeApiKey('re_only', 'only');

    removeApiKey('only');

    const { existsSync } = require('node:fs');
    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);
  });

  it('throws when profile does not exist', () => {
    storeApiKey('re_default');
    expect(() => removeApiKey('nonexistent')).toThrow('not found');
  });

  it('throws when no credentials file', () => {
    expect(() => removeApiKey('any')).toThrow('No credentials file');
  });
});

describe('renameProfile', () => {
  const restoreEnv = captureTestEnv();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renames a profile and preserves its API key', () => {
    storeApiKey('re_key', 'old-name');

    renameProfile('old-name', 'new-name');

    const profiles = listProfiles();
    expect(profiles).toEqual([{ name: 'new-name', active: true }]);
    const resolved = resolveApiKey(undefined, 'new-name');
    expect(resolved?.key).toBe('re_key');
  });

  it('updates active_profile when renaming the active profile', () => {
    storeApiKey('re_a', 'alpha');
    storeApiKey('re_b', 'beta');
    setActiveProfile('beta');

    renameProfile('beta', 'gamma');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('gamma');
  });

  it('does not change active_profile when renaming a non-active profile', () => {
    storeApiKey('re_a', 'alpha');
    storeApiKey('re_b', 'beta');

    renameProfile('beta', 'gamma');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_profile).toBe('alpha');
  });

  it('renames a legacy profile with spaces', () => {
    // Simulate a legacy profile created before validation was added
    writeCredentials({
      active_profile: 'my team',
      profiles: { 'my team': { api_key: 're_legacy' } },
    });

    renameProfile('my team', 'my-team');

    const profiles = listProfiles();
    expect(profiles).toEqual([{ name: 'my-team', active: true }]);
    const resolved = resolveApiKey(undefined, 'my-team');
    expect(resolved?.key).toBe('re_legacy');
  });

  it('throws when new name is invalid', () => {
    storeApiKey('re_key', 'valid');
    expect(() => renameProfile('valid', 'has spaces')).toThrow('letters');
  });

  it('throws when old profile does not exist', () => {
    storeApiKey('re_key', 'exists');
    expect(() => renameProfile('nope', 'new-name')).toThrow('not found');
  });

  it('throws when new name already exists', () => {
    storeApiKey('re_a', 'alpha');
    storeApiKey('re_b', 'beta');
    expect(() => renameProfile('alpha', 'beta')).toThrow('already exists');
  });

  it('throws when no credentials file', () => {
    expect(() => renameProfile('any', 'new')).toThrow('No credentials file');
  });
});

describe('validateProfileName', () => {
  it('accepts valid names', () => {
    expect(validateProfileName('default')).toBeUndefined();
    expect(validateProfileName('my-profile')).toBeUndefined();
    expect(validateProfileName('profile_1')).toBeUndefined();
    expect(validateProfileName('prod-2024')).toBeUndefined();
    expect(validateProfileName('Production')).toBeUndefined();
    expect(validateProfileName('MyProfile')).toBeUndefined();
    expect(validateProfileName('resend.com')).toBeUndefined();
    expect(validateProfileName('my.profile')).toBeUndefined();
  });

  it('rejects spaces and special characters', () => {
    expect(validateProfileName('my profile')).toContain('dots');
    expect(validateProfileName('profile@org')).toContain('dots');
  });

  it('rejects empty name', () => {
    expect(validateProfileName('')).toContain('empty');
  });

  it('rejects names longer than 64 characters', () => {
    const longName = 'a'.repeat(65);
    expect(validateProfileName(longName)).toContain('64');
  });

  it('accepts name exactly 64 characters', () => {
    const maxName = 'a'.repeat(64);
    expect(validateProfileName(maxName)).toBeUndefined();
  });
});
