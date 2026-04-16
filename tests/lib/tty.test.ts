import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTestEnv } from '../helpers';

// We need to import the module fresh per test to pick up env changes,
// so we use dynamic imports.

describe('isInteractive', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    restoreEnv();
  });

  function setTTY(stdin: boolean, stdout: boolean) {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: stdin ? true : undefined,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: stdout ? true : undefined,
      writable: true,
    });
  }

  it('returns true when stdin and stdout are TTY and no CI env', async () => {
    setTTY(true, true);
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(true);
  });

  it('returns false when stdin is not TTY', async () => {
    setTTY(false, true);
    delete process.env.CI;

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  it('returns false when stdout is not TTY', async () => {
    setTTY(true, false);
    delete process.env.CI;

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  it('returns false when CI=true', async () => {
    setTTY(true, true);
    process.env.CI = 'true';

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  it('returns false when CI=1', async () => {
    setTTY(true, true);
    process.env.CI = '1';

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  it('returns false when GITHUB_ACTIONS is set', async () => {
    setTTY(true, true);
    delete process.env.CI;
    process.env.GITHUB_ACTIONS = 'true';

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  it('returns false when TERM=dumb', async () => {
    setTTY(true, true);
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    process.env.TERM = 'dumb';

    const { isInteractive } = await import('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });
});
