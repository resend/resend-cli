import {
  afterEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { outputError, outputResult } from '../../src/lib/output';

describe('outputResult', () => {
  let logSpy: MockInstance;
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    logSpy?.mockRestore();
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    });
  });

  test('outputs JSON when json option is true', () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ id: '123' }, { json: true });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: '123' }, null, 2));
  });

  test('outputs JSON when stdout is not TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ id: '123' });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: '123' }, null, 2));
  });

  test('outputs string directly for human-readable mode', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult('Email sent successfully');
    expect(logSpy).toHaveBeenCalledWith('Email sent successfully');
  });

  test('outputs JSON for objects in human mode (fallback)', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ id: '123' });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: '123' }, null, 2));
  });
});

describe('outputError', () => {
  let errorSpy: MockInstance;
  let exitSpy: MockInstance;
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
    });
  });

  test('outputs JSON error to stderr when json is true', () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({ message: 'not found', code: 'not_found' }, { json: true });

    const expected = JSON.stringify(
      { error: { message: 'not found', code: 'not_found' } },
      null,
      2,
    );
    expect(errorSpy).toHaveBeenCalledWith(expected);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('outputs text error when TTY and no json flag', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({ message: 'something broke' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('something broke'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('uses custom exit code', () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({ message: 'error' }, { exitCode: 2, json: true });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  test('defaults error code to "unknown" when not provided', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({ message: 'oops' });

    const output = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.error.code).toBe('unknown');
  });
});
