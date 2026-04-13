import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { withSpinner } from '../../src/lib/spinner';
import * as timeoutModule from '../../src/lib/with-timeout';
import {
  captureTestEnv,
  ExitError,
  mockExitThrow,
  setNonInteractive,
} from '../helpers';

describe('withSpinner retry on rate_limit_exceeded', () => {
  const restoreEnv = captureTestEnv();
  let exitSpy: MockInstance;
  let errorSpy: MockInstance;
  let stderrSpy: MockInstance;

  const msgs = {
    loading: 'Loading...',
    success: 'Done',
    fail: 'Failed',
  };
  const globalOpts = { json: true };

  beforeEach(() => {
    setNonInteractive();
    exitSpy = mockExitThrow();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    restoreEnv();
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  test('retries on rate_limit_exceeded and succeeds', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      if (calls === 1) {
        return {
          data: null,
          error: {
            message: 'Rate limit exceeded',
            name: 'rate_limit_exceeded',
          },
          headers: { 'retry-after': '0' },
        };
      }
      return { data: { id: 'abc' }, error: null, headers: null };
    };

    const result = await withSpinner(msgs, call, 'test_error', globalOpts);
    expect(result).toEqual({ id: 'abc' });
    expect(calls).toBe(2);
  });

  test('exhausts retries and errors after max attempts', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      return {
        data: null,
        error: {
          message: 'Rate limit exceeded',
          name: 'rate_limit_exceeded',
        },
        headers: { 'retry-after': '0' },
      };
    };

    let threw = false;
    try {
      await withSpinner(msgs, call, 'test_error', globalOpts);
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }
    expect(threw).toBe(true);
    // 1 initial + 3 retries = 4 total calls
    expect(calls).toBe(4);
  });

  test('does not retry non-retryable errors', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      return {
        data: null,
        error: { message: 'Not found', name: 'not_found' },
        headers: null,
      };
    };

    let threw = false;
    try {
      await withSpinner(msgs, call, 'test_error', globalOpts);
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);
    expect(calls).toBe(1);
  });

  test('does not retry daily_quota_exceeded', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      return {
        data: null,
        error: {
          message: 'Daily quota exceeded',
          name: 'daily_quota_exceeded',
        },
        headers: null,
      };
    };

    let threw = false;
    try {
      await withSpinner(msgs, call, 'test_error', globalOpts);
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);
    expect(calls).toBe(1);
  });

  test('uses retry-after header for delay', async () => {
    let calls = 0;
    const start = Date.now();
    const call = async () => {
      calls++;
      if (calls === 1) {
        return {
          data: null,
          error: {
            message: 'Rate limit exceeded',
            name: 'rate_limit_exceeded',
          },
          headers: { 'retry-after': '0' },
        };
      }
      return { data: { ok: true }, error: null, headers: null };
    };

    const result = await withSpinner(msgs, call, 'test_error', globalOpts);
    expect(result).toEqual({ ok: true });
    // retry-after: 0 means near-instant retry
    expect(Date.now() - start).toBeLessThan(500);
  });

  test('falls back to default delay without retry-after', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      if (calls === 1) {
        return {
          data: null,
          error: {
            message: 'Rate limit exceeded',
            name: 'rate_limit_exceeded',
          },
          headers: null,
        };
      }
      return { data: { ok: true }, error: null, headers: null };
    };

    const start = Date.now();
    const result = await withSpinner(msgs, call, 'test_error', globalOpts);
    expect(result).toEqual({ ok: true });
    // Default first retry delay is 1s
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });

  test('exits with error when request times out', async () => {
    vi.spyOn(timeoutModule, 'withTimeout').mockRejectedValue(
      new Error('Request timed out after 30s'),
    );

    let threw = false;
    try {
      await withSpinner(
        msgs,
        async () => ({ data: null, error: null, headers: null }),
        'test_error',
        globalOpts,
      );
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }
    expect(threw).toBe(true);
    const errOutput = errorSpy.mock.calls.flat().join(' ');
    expect(errOutput).toContain('timed out');
  });
});

describe('createSpinner', () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalStdinIsTTY,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdoutIsTTY,
      writable: true,
    });
    delete process.env.CI;
  });

  test('returns no-op spinner in non-interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });

    const { createSpinner } = await import('../../src/lib/spinner');
    const spinner = createSpinner('test message');

    // Should not throw when calling any method
    expect(() => spinner.stop('done')).not.toThrow();
    expect(() => spinner.fail('error')).not.toThrow();
    expect(() => spinner.warn('warning')).not.toThrow();
    expect(() => spinner.update('updating')).not.toThrow();
  });

  test('returns functional spinner in interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const { createSpinner } = await import('../../src/lib/spinner');
    const spinner = createSpinner('loading...');

    expect(spinner).toHaveProperty('stop');
    expect(spinner).toHaveProperty('fail');
    expect(spinner).toHaveProperty('warn');
    expect(spinner).toHaveProperty('update');

    // Stop to clean up the interval
    spinner.stop('done');
    expect(stderrSpy).toHaveBeenCalled();
  });

  test('stop writes checkmark to stderr', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const { createSpinner } = await import('../../src/lib/spinner');
    const spinner = createSpinner('loading...');
    spinner.stop('completed');

    const lastCall = stderrSpy.mock.calls[
      stderrSpy.mock.calls.length - 1
    ][0] as string;
    expect(lastCall).toContain('✔');
    expect(lastCall).toContain('completed');
  });

  test('fail writes cross mark to stderr', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const { createSpinner } = await import('../../src/lib/spinner');
    const spinner = createSpinner('loading...');
    spinner.fail('error occurred');

    const lastCall = stderrSpy.mock.calls[
      stderrSpy.mock.calls.length - 1
    ][0] as string;
    expect(lastCall).toContain('✗');
    expect(lastCall).toContain('error occurred');
  });

  test('warn writes warning icon to stderr', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;

    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const { createSpinner } = await import('../../src/lib/spinner');
    const spinner = createSpinner('loading...');
    spinner.warn('watch out');

    const lastCall = stderrSpy.mock.calls[
      stderrSpy.mock.calls.length - 1
    ][0] as string;
    expect(lastCall).toContain('⚠');
    expect(lastCall).toContain('watch out');
  });
});
