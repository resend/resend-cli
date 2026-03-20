import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCancelExitCode,
  setSigintHandler,
  setupCliExitHandler,
} from '../../src/lib/cli-exit';
import { ExitError, expectExitCode, mockExitThrow } from '../helpers';

describe('cli-exit', () => {
  let exitSpy: ReturnType<typeof mockExitThrow>;

  beforeEach(() => {
    exitSpy = mockExitThrow();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
  });

  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    vi.restoreAllMocks();
  });

  it('getCancelExitCode() returns 130', () => {
    expect(getCancelExitCode()).toBe(130);
  });

  it('default SIGINT handler calls process.exit(130)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupCliExitHandler();

    expect(() => process.emit('SIGINT', 'SIGINT')).toThrow(ExitError);
    expect(exitSpy).toHaveBeenCalledWith(130);
  });

  it('default SIGINT handler clears terminal line when stderr is TTY', () => {
    const originalIsTTY = process.stderr.isTTY;
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(process.stderr, 'isTTY', {
      value: true,
      configurable: true,
    });

    setupCliExitHandler();

    try {
      expect(() => process.emit('SIGINT', 'SIGINT')).toThrow(ExitError);
      expect(stderrSpy).toHaveBeenCalledWith('\r\x1B[2K');
    } finally {
      Object.defineProperty(process.stderr, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    }
  });

  it('setSigintHandler() replaces the default handler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupCliExitHandler();

    const custom = vi.fn(() => {
      process.exit(getCancelExitCode());
    });
    setSigintHandler(custom);

    await expectExitCode(130, async () => {
      process.emit('SIGINT', 'SIGINT');
    });
    expect(custom).toHaveBeenCalledOnce();
  });
});
