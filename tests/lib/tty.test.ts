import { afterEach, describe, expect, test } from 'bun:test';
import { captureTestEnv } from '../helpers';

// We need to import the module fresh per test to pick up env changes,
// so we use dynamic imports.

describe('isInteractive', () => {
  const restoreEnv = captureTestEnv();

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

  test('returns true when stdin and stdout are TTY and no CI env', () => {
    setTTY(true, true);
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(true);
  });

  test('returns false when stdin is not TTY', () => {
    setTTY(false, true);
    delete process.env.CI;

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  test('returns false when stdout is not TTY', () => {
    setTTY(true, false);
    delete process.env.CI;

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  test('returns false when CI=true', () => {
    setTTY(true, true);
    process.env.CI = 'true';

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  test('returns false when CI=1', () => {
    setTTY(true, true);
    process.env.CI = '1';

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  test('returns false when GITHUB_ACTIONS is set', () => {
    setTTY(true, true);
    delete process.env.CI;
    process.env.GITHUB_ACTIONS = 'true';

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });

  test('returns false when TERM=dumb', () => {
    setTTY(true, true);
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    process.env.TERM = 'dumb';

    const { isInteractive } = require('../../src/lib/tty');
    expect(isInteractive()).toBe(false);
  });
});
