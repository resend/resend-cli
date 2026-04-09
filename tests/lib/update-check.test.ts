import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(() => ({ unref: vi.fn() })) };
});

import { spawn } from 'node:child_process';
import {
  buildRefreshScript,
  checkForUpdates,
  detectInstallMethod,
  resolveNodePath,
  spawnBackgroundRefresh,
} from '../../src/lib/update-check';
import { VERSION } from '../../src/lib/version';
import { captureTestEnv } from '../helpers';

const NEWER_VERSION = '99.0.0';

const testConfigDir = join(tmpdir(), `resend-update-check-test-${process.pid}`);
const testResendDir = join(testConfigDir, 'resend');
const statePath = join(testResendDir, 'update-state.json');

const mockedSpawn = vi.mocked(spawn);

describe('checkForUpdates', () => {
  const restoreEnv = captureTestEnv();
  let stderrOutput: string;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    mkdirSync(testResendDir, { recursive: true });
    stderrOutput = '';
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk) => {
        stderrOutput += String(chunk);
        return true;
      });

    mockedSpawn.mockReturnValue({ unref: vi.fn() } as never);

    process.env.XDG_CONFIG_HOME = testConfigDir;

    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.RESEND_NO_UPDATE_NOTIFIER;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    mockedSpawn.mockClear();
    restoreEnv();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  it('skips check when RESEND_NO_UPDATE_NOTIFIER=1', () => {
    process.env.RESEND_NO_UPDATE_NOTIFIER = '1';
    checkForUpdates();
    expect(stderrOutput).toBe('');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('skips check when CI=true', () => {
    process.env.CI = 'true';
    checkForUpdates();
    expect(stderrOutput).toBe('');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('skips check when not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });
    checkForUpdates();
    expect(stderrOutput).toBe('');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('prints notice from fresh cache when newer version available', () => {
    writeFileSync(
      statePath,
      JSON.stringify({
        lastChecked: Date.now(),
        latestVersion: NEWER_VERSION,
      }),
    );

    checkForUpdates();

    expect(stderrOutput).toContain('Update available');
    expect(stderrOutput).toContain(`v${VERSION}`);
    expect(stderrOutput).toContain(`v${NEWER_VERSION}`);
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('prints nothing from fresh cache when already on latest', () => {
    writeFileSync(
      statePath,
      JSON.stringify({ lastChecked: Date.now(), latestVersion: VERSION }),
    );

    checkForUpdates();
    expect(stderrOutput).toBe('');
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('spawns background refresh when cache is stale', () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000;
    writeFileSync(
      statePath,
      JSON.stringify({ lastChecked: staleTime, latestVersion: VERSION }),
    );

    checkForUpdates();

    expect(mockedSpawn).toHaveBeenCalledWith(
      expect.any(String),
      ['-e', expect.any(String)],
      { detached: true, stdio: 'ignore' },
    );
  });

  it('spawns background refresh when cache is missing', () => {
    checkForUpdates();
    expect(mockedSpawn).toHaveBeenCalled();
  });

  it('shows stale notice and spawns refresh when cache is stale with newer version', () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000;
    writeFileSync(
      statePath,
      JSON.stringify({
        lastChecked: staleTime,
        latestVersion: NEWER_VERSION,
      }),
    );

    checkForUpdates();

    expect(stderrOutput).toContain('Update available');
    expect(mockedSpawn).toHaveBeenCalled();
  });

  it('does not show notice when cache is missing (no stale version)', () => {
    checkForUpdates();
    expect(stderrOutput).toBe('');
    expect(mockedSpawn).toHaveBeenCalled();
  });
});

describe('buildRefreshScript', () => {
  it('produces a script containing fetch and fs operations', () => {
    const script = buildRefreshScript(
      'https://api.github.com/repos/resend/resend-cli/releases/latest',
      '/tmp/resend-test',
      '/tmp/resend-test/update-state.json',
      '1.0.0',
    );

    expect(script).toContain('fetch');
    expect(script).toContain('mkdirSync');
    expect(script).toContain('writeFileSync');
    expect(script).toContain('"1.0.0"');
  });

  it('embeds the config directory and state path', () => {
    const dir = '/home/user/.config/resend';
    const path = `${dir}/update-state.json`;
    const script = buildRefreshScript(
      'https://example.com/releases',
      dir,
      path,
      '2.0.0',
    );

    expect(script).toContain(JSON.stringify(dir));
    expect(script).toContain(JSON.stringify(path));
  });

  it('writes fallback version on non-ok response', () => {
    const script = buildRefreshScript(
      'https://example.com/releases',
      '/tmp/dir',
      '/tmp/dir/state.json',
      '3.0.0',
    );

    expect(script).toContain('!r.ok');
    expect(script).toContain('"3.0.0"');
  });
});

describe('resolveNodePath', () => {
  it('returns execPath when it ends with node', () => {
    const orig = process.execPath;
    Object.defineProperty(process, 'execPath', { value: '/usr/bin/node' });
    expect(resolveNodePath()).toBe('/usr/bin/node');
    Object.defineProperty(process, 'execPath', { value: orig });
  });

  it('returns execPath when it ends with node.exe', () => {
    const orig = process.execPath;
    Object.defineProperty(process, 'execPath', {
      value: 'C:\\Program Files\\nodejs\\node.exe',
    });
    expect(resolveNodePath()).toBe('C:\\Program Files\\nodejs\\node.exe');
    Object.defineProperty(process, 'execPath', { value: orig });
  });

  it('returns "node" when execPath is not a node binary', () => {
    const orig = process.execPath;
    Object.defineProperty(process, 'execPath', {
      value: '/usr/local/bin/resend',
    });
    expect(resolveNodePath()).toBe('node');
    Object.defineProperty(process, 'execPath', { value: orig });
  });
});

describe('spawnBackgroundRefresh', () => {
  beforeEach(() => {
    mockedSpawn.mockClear();
  });

  it('does not throw when spawn throws', () => {
    mockedSpawn.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    expect(() => spawnBackgroundRefresh()).not.toThrow();
  });

  it('calls spawn with detached and ignored stdio', () => {
    mockedSpawn.mockReturnValue({ unref: vi.fn() } as never);

    spawnBackgroundRefresh();

    expect(mockedSpawn).toHaveBeenCalledWith(
      expect.any(String),
      ['-e', expect.any(String)],
      { detached: true, stdio: 'ignore' },
    );
  });

  it('unrefs the child process', () => {
    const unrefFn = vi.fn();
    mockedSpawn.mockReturnValue({ unref: unrefFn } as never);

    spawnBackgroundRefresh();

    expect(unrefFn).toHaveBeenCalled();
  });
});

describe('detectInstallMethod', () => {
  const restoreEnv = captureTestEnv();
  let origExecPath: string;
  let origArgv1: string | undefined;

  beforeEach(() => {
    origExecPath = process.execPath;
    origArgv1 = process.argv[1];
    delete process.env.npm_execpath;
  });

  afterEach(() => {
    Object.defineProperty(process, 'execPath', { value: origExecPath });
    process.argv[1] = origArgv1 as string;
    restoreEnv();
  });

  it('detects npm when script path contains node_modules', () => {
    Object.defineProperty(process, 'execPath', {
      value: '/opt/homebrew/bin/node',
    });
    process.argv[1] = '/opt/homebrew/lib/node_modules/resend-cli/dist/cli.js';

    expect(detectInstallMethod()).toBe('npm install -g resend-cli');
  });

  it('detects npm when npm_execpath is set even with homebrew node', () => {
    Object.defineProperty(process, 'execPath', {
      value: '/opt/homebrew/bin/node',
    });
    process.argv[1] = '/opt/homebrew/bin/resend';
    process.env.npm_execpath =
      '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js';

    expect(detectInstallMethod()).toBe('npm install -g resend-cli');
  });

  it('detects homebrew when no npm signals present', () => {
    Object.defineProperty(process, 'execPath', {
      value: '/opt/homebrew/Cellar/resend/1.4.0/bin/resend',
    });
    process.argv[1] = '/opt/homebrew/Cellar/resend/1.4.0/libexec/cli.js';

    expect(detectInstallMethod()).toBe('brew update && brew upgrade resend');
  });

  it('detects install script', () => {
    Object.defineProperty(process, 'execPath', {
      value: '/Users/test/.resend/bin/resend',
    });
    process.argv[1] = '/Users/test/.resend/bin/resend';

    const expected = process.platform === 'win32' ? 'irm' : 'curl';
    expect(detectInstallMethod()).toContain(expected);
  });
});
