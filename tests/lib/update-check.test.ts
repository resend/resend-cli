import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { checkForUpdates } from '../../src/lib/update-check';
import { VERSION } from '../../src/lib/version';
import { captureTestEnv } from '../helpers';

// Use a version guaranteed to be "newer" than whatever VERSION is
const NEWER_VERSION = '99.0.0';

const testConfigDir = join(tmpdir(), `resend-update-check-test-${process.pid}`);
const testResendDir = join(testConfigDir, 'resend');
const statePath = join(testResendDir, 'update-state.json');

describe('checkForUpdates', () => {
  const restoreEnv = captureTestEnv();
  let stderrOutput: string;
  let stderrSpy: MockInstance;
  let fetchSpy: MockInstance;

  beforeEach(() => {
    mkdirSync(testResendDir, { recursive: true });
    stderrOutput = '';
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((chunk) => {
        stderrOutput += String(chunk);
        return true;
      });

    // Point getConfigDir() at our temp dir via XDG_CONFIG_HOME
    process.env.XDG_CONFIG_HOME = testConfigDir;

    // Ensure TTY and no CI
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
    if (fetchSpy) {
      fetchSpy.mockRestore();
    }
    restoreEnv();
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  function mockFetch(tagName: string, extra: Record<string, unknown> = {}) {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: tagName, ...extra }),
    } as Response);
  }

  function mockFetchFailure() {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network error'));
  }

  test('skips check when RESEND_NO_UPDATE_NOTIFIER=1', async () => {
    process.env.RESEND_NO_UPDATE_NOTIFIER = '1';
    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });

  test('skips check when CI=true', async () => {
    process.env.CI = 'true';
    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });

  test('skips check when not a TTY', async () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });
    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });

  test('prints notice when newer version available from fresh fetch', async () => {
    mockFetch(`v${NEWER_VERSION}`);
    await checkForUpdates();

    expect(stderrOutput).toContain('Update available');
    expect(stderrOutput).toContain(`v${VERSION}`);
    expect(stderrOutput).toContain(`v${NEWER_VERSION}`);
  });

  test('prints nothing when already on latest', async () => {
    mockFetch(`v${VERSION}`);
    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });

  test('uses cached state when fresh (no fetch)', async () => {
    writeFileSync(
      statePath,
      JSON.stringify({ lastChecked: Date.now(), latestVersion: NEWER_VERSION }),
    );

    mockFetch(`v${NEWER_VERSION}`);
    await checkForUpdates();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stderrOutput).toContain(`v${NEWER_VERSION}`);
  });

  test('refetches when cache is stale', async () => {
    const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    writeFileSync(
      statePath,
      JSON.stringify({ lastChecked: staleTime, latestVersion: VERSION }),
    );

    mockFetch(`v${NEWER_VERSION}`);
    await checkForUpdates();

    expect(fetchSpy).toHaveBeenCalled();
    expect(stderrOutput).toContain(`v${NEWER_VERSION}`);
    // Verify cache was updated
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(state.latestVersion).toBe(NEWER_VERSION);
  });

  test('handles fetch failure gracefully', async () => {
    mockFetchFailure();
    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });

  test('writes state file after successful fetch', async () => {
    mockFetch(`v${VERSION}`);
    await checkForUpdates();

    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(state.latestVersion).toBe(VERSION);
  });

  test('ignores prerelease versions', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v99.0.0', prerelease: true }),
    } as Response);

    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });

  test('ignores non-semver tag names', async () => {
    mockFetch('canary-20260311');
    await checkForUpdates();
    expect(stderrOutput).toBe('');
  });
});
