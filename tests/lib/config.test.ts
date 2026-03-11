import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getConfigDir,
  listTeams,
  removeApiKey,
  resolveApiKey,
  resolveTeamName,
  setActiveTeam,
  storeApiKey,
  validateTeamName,
} from '../../src/lib/config';
import { captureTestEnv } from '../helpers';

describe('getConfigDir', () => {
  const restoreEnv = captureTestEnv();

  afterEach(() => {
    restoreEnv();
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
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'default',
        teams: { default: { api_key: 're_config_key' } },
      }),
    );

    const result = resolveApiKey();
    expect(result).toEqual({
      key: 're_config_key',
      source: 'config',
      team: 'default',
    });
  });

  test('reads legacy format (api_key at root)', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(
      join(configDir, 'credentials.json'),
      JSON.stringify({ api_key: 're_legacy_key' }),
    );

    const result = resolveApiKey();
    expect(result).toEqual({
      key: 're_legacy_key',
      source: 'config',
      team: 'default',
    });
  });

  test('resolves specific team from config', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'default',
        teams: {
          default: { api_key: 're_default' },
          staging: { api_key: 're_staging' },
        },
      }),
    );

    const result = resolveApiKey(undefined, 'staging');
    expect(result).toEqual({
      key: 're_staging',
      source: 'config',
      team: 'staging',
    });
  });

  test('returns null when no key found', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
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

  test('returns null when team does not exist in config', () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'default',
        teams: { default: { api_key: 're_default' } },
      }),
    );

    const result = resolveApiKey(undefined, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('resolveTeamName', () => {
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

  test('flag value takes highest priority', () => {
    process.env.RESEND_TEAM = 'env_team';
    expect(resolveTeamName('flag_team')).toBe('flag_team');
  });

  test('env var is second priority', () => {
    process.env.RESEND_TEAM = 'env_team';
    expect(resolveTeamName()).toBe('env_team');
  });

  test('active_team from config is third priority', () => {
    delete process.env.RESEND_TEAM;
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    Bun.write(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'production',
        teams: { production: { api_key: 're_xxx' } },
      }),
    );

    expect(resolveTeamName()).toBe('production');
  });

  test('defaults to "default" when nothing configured', () => {
    delete process.env.RESEND_TEAM;
    expect(resolveTeamName()).toBe('default');
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

  test('writes credentials.json with team structure', () => {
    const configPath = storeApiKey('re_test_key_123');
    expect(configPath).toContain('credentials.json');

    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_team).toBe('default');
    expect(data.teams.default.api_key).toBe('re_test_key_123');
  });

  test('stores key under specific team name', () => {
    const configPath = storeApiKey('re_staging_key', 'staging');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.teams.staging.api_key).toBe('re_staging_key');
  });

  test('preserves existing teams when adding new one', () => {
    storeApiKey('re_default_key');
    storeApiKey('re_staging_key', 'staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.teams.default.api_key).toBe('re_default_key');
    expect(data.teams.staging.api_key).toBe('re_staging_key');
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
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test('overwrites existing team key', () => {
    storeApiKey('re_first_key');
    storeApiKey('re_second_key');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.teams.default.api_key).toBe('re_second_key');
  });

  test('sets first team as active', () => {
    storeApiKey('re_first_key', 'myteam');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_team).toBe('myteam');
  });
});

describe('listTeams', () => {
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

  test('returns empty array when no config', () => {
    expect(listTeams()).toEqual([]);
  });

  test('returns teams with active flag', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    const teams = listTeams();
    expect(teams).toEqual([
      { name: 'default', active: true },
      { name: 'staging', active: false },
    ]);
  });
});

describe('setActiveTeam', () => {
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

  test('switches active team', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    setActiveTeam('staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_team).toBe('staging');
  });

  test('throws when team does not exist', () => {
    storeApiKey('re_default');
    expect(() => setActiveTeam('nonexistent')).toThrow('not found');
  });

  test('throws when no credentials file', () => {
    expect(() => setActiveTeam('any')).toThrow('No credentials file');
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

  test('removes a team entry', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    removeApiKey('staging');

    const teams = listTeams();
    expect(teams).toEqual([{ name: 'default', active: true }]);
  });

  test('adjusts active_team when active is removed', () => {
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');
    setActiveTeam('staging');

    removeApiKey('staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_team).toBe('default');
  });

  test('deletes file when last team removed', () => {
    storeApiKey('re_only', 'only');

    removeApiKey('only');

    const { existsSync } = require('node:fs');
    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);
  });

  test('throws when team does not exist', () => {
    storeApiKey('re_default');
    expect(() => removeApiKey('nonexistent')).toThrow('not found');
  });

  test('throws when no credentials file', () => {
    expect(() => removeApiKey('any')).toThrow('No credentials file');
  });
});

describe('validateTeamName', () => {
  test('accepts valid names', () => {
    expect(validateTeamName('default')).toBeUndefined();
    expect(validateTeamName('my-team')).toBeUndefined();
    expect(validateTeamName('team_1')).toBeUndefined();
    expect(validateTeamName('prod-2024')).toBeUndefined();
    expect(validateTeamName('Production')).toBeUndefined();
    expect(validateTeamName('MyTeam')).toBeUndefined();
  });

  test('rejects spaces and special characters', () => {
    expect(validateTeamName('my team')).toContain('letters');
    expect(validateTeamName('team@org')).toContain('letters');
  });

  test('rejects empty name', () => {
    expect(validateTeamName('')).toContain('empty');
  });

  test('rejects names longer than 64 characters', () => {
    const longName = 'a'.repeat(65);
    expect(validateTeamName(longName)).toContain('64');
  });

  test('accepts name exactly 64 characters', () => {
    const maxName = 'a'.repeat(64);
    expect(validateTeamName(maxName)).toBeUndefined();
  });
});
