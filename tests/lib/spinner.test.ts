import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { withSpinner } from '../../src/lib/spinner';
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

  it('retries on rate_limit_exceeded and succeeds', async () => {
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

  it('exhausts retries and errors after max attempts', async () => {
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
    expect(calls).toBe(4);
  });

  it('does not retry non-retryable errors', async () => {
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

  it('does not retry daily_quota_exceeded', async () => {
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

  it('uses retry-after header for delay', async () => {
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
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('falls back to default delay without retry-after', async () => {
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
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });
});

describe('withSpinner retry on transient 5xx errors', () => {
  const restoreEnv = captureTestEnv();
  let exitSpy: MockInstance;
  let errorSpy: MockInstance;
  let stderrSpy: MockInstance;

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

  it('retries internal_server_error when retryTransient is true', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      if (calls === 1) {
        return {
          data: null,
          error: {
            message: 'Internal server error',
            name: 'internal_server_error',
          },
          headers: null,
        };
      }
      return { data: { id: 'ok' }, error: null, headers: null };
    };

    const result = await withSpinner(
      { loading: 'Loading...', retryTransient: true },
      call,
      'test_error',
      globalOpts,
    );
    expect(result).toEqual({ id: 'ok' });
    expect(calls).toBe(2);
  });

  it('retries service_unavailable when retryTransient is true', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      if (calls === 1) {
        return {
          data: null,
          error: {
            message: 'Service unavailable',
            name: 'service_unavailable',
          },
          headers: null,
        };
      }
      return { data: { id: 'ok' }, error: null, headers: null };
    };

    const result = await withSpinner(
      { loading: 'Loading...', retryTransient: true },
      call,
      'test_error',
      globalOpts,
    );
    expect(result).toEqual({ id: 'ok' });
    expect(calls).toBe(2);
  });

  it('retries gateway_timeout when retryTransient is true', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      if (calls === 1) {
        return {
          data: null,
          error: { message: 'Gateway timeout', name: 'gateway_timeout' },
          headers: null,
        };
      }
      return { data: { id: 'ok' }, error: null, headers: null };
    };

    const result = await withSpinner(
      { loading: 'Loading...', retryTransient: true },
      call,
      'test_error',
      globalOpts,
    );
    expect(result).toEqual({ id: 'ok' });
    expect(calls).toBe(2);
  });

  it('does not retry transient errors when retryTransient is false', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      return {
        data: null,
        error: {
          message: 'Internal server error',
          name: 'internal_server_error',
        },
        headers: null,
      };
    };

    let threw = false;
    try {
      await withSpinner(
        { loading: 'Loading...' },
        call,
        'test_error',
        globalOpts,
      );
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);
    expect(calls).toBe(1);
  });

  it('exhausts transient retries and errors after max attempts', async () => {
    let calls = 0;
    const call = async () => {
      calls++;
      return {
        data: null,
        error: {
          message: 'Internal server error',
          name: 'internal_server_error',
        },
        headers: { 'retry-after': '0' },
      };
    };

    let threw = false;
    try {
      await withSpinner(
        { loading: 'Loading...', retryTransient: true },
        call,
        'test_error',
        globalOpts,
      );
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);
    expect(calls).toBe(4);
  });

  it('still retries rate_limit_exceeded even without retryTransient', async () => {
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
      return { data: { id: 'ok' }, error: null, headers: null };
    };

    const result = await withSpinner(
      { loading: 'Loading...' },
      call,
      'test_error',
      globalOpts,
    );
    expect(result).toEqual({ id: 'ok' });
    expect(calls).toBe(2);
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

  it('returns no-op spinner in non-interactive mode', async () => {
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

    expect(() => spinner.stop('done')).not.toThrow();
    expect(() => spinner.fail('error')).not.toThrow();
    expect(() => spinner.warn('warning')).not.toThrow();
    expect(() => spinner.update('updating')).not.toThrow();
  });

  it('returns functional spinner in interactive mode', async () => {
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

    spinner.stop('done');
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('stop writes checkmark to stderr', async () => {
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

  it('fail writes cross mark to stderr', async () => {
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

  it('warn writes warning icon to stderr', async () => {
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
