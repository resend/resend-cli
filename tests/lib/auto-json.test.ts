import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { captureTestEnv } from '../helpers';

describe('shouldAutoEnableJson', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    restoreEnv();
  });

  function setTTY(stdout: boolean) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: stdout ? true : undefined,
      writable: true,
    });
  }

  function clearEnv() {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;
  }

  test('returns true when stdout is not TTY', async () => {
    setTTY(false);
    clearEnv();
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson()).toBe(true);
  });

  test('returns true when CI=true', async () => {
    setTTY(true);
    clearEnv();
    process.env.CI = 'true';
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson()).toBe(true);
  });

  test('returns true when CI=1', async () => {
    setTTY(true);
    clearEnv();
    process.env.CI = '1';
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson()).toBe(true);
  });

  test('returns true when GITHUB_ACTIONS is set', async () => {
    setTTY(true);
    clearEnv();
    process.env.GITHUB_ACTIONS = 'true';
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson()).toBe(true);
  });

  test('returns true when TERM=dumb', async () => {
    setTTY(true);
    clearEnv();
    process.env.TERM = 'dumb';
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson()).toBe(true);
  });

  test('returns false when stdout is TTY and no CI env', async () => {
    setTTY(true);
    clearEnv();
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson()).toBe(false);
  });

  test('returns false when json is already true', async () => {
    setTTY(false);
    clearEnv();
    const { shouldAutoEnableJson } = await import('../../src/lib/auto-json');
    expect(shouldAutoEnableJson(true)).toBe(false);
  });
});
