import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';

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
