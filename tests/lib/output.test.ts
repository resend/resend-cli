import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
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

  it('outputs JSON when json option is true', () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ id: '123' }, { json: true });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: '123' }, null, 2));
  });

  it('outputs JSON when stdout is not TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: undefined,
      writable: true,
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ id: '123' });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: '123' }, null, 2));
  });

  it('outputs string directly for human-readable mode', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult('Email sent successfully');
    expect(logSpy).toHaveBeenCalledWith('Email sent successfully');
  });

  it('outputs JSON for objects in human mode (fallback)', () => {
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

  it('outputs JSON error to stderr when json is true', () => {
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

  it('outputs text error when TTY and no json flag', () => {
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

  it('uses custom exit code', () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({ message: 'error' }, { exitCode: 2, json: true });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('defaults error code to "unknown" when not provided', () => {
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

  it('surfaces statusCode, headers and body in JSON mode when provided', () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError(
      {
        message:
          'Internal server error. We are unable to process your request right now, please try again later.',
        code: 'send_error',
        statusCode: 403,
        headers: {
          'content-type': 'text/plain',
          'x-deny-reason': 'host_not_allowed',
        },
        body: 'Host not in allowlist',
      },
      { json: true },
    );

    const output = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.error.statusCode).toBe(403);
    expect(parsed.error.headers).toEqual({
      'content-type': 'text/plain',
      'x-deny-reason': 'host_not_allowed',
    });
    expect(parsed.error.body).toBe('Host not in allowlist');
  });

  it('appends a status/header hint to TTY error output when provided', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({
      message:
        'Internal server error. We are unable to process your request right now, please try again later.',
      code: 'send_error',
      statusCode: 403,
      headers: { 'x-deny-reason': 'host_not_allowed' },
    });

    const output = errorSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toMatch(/HTTP 403/);
    expect(output).toMatch(/x-deny-reason: host_not_allowed/);
  });

  it('filters non-diagnostic headers from JSON output', () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError(
      {
        message: 'denied',
        code: 'send_error',
        statusCode: 403,
        headers: {
          'set-cookie': 'session=secret',
          date: 'Thu, 28 May 2026 13:35:05 GMT',
          server: 'nginx',
          'content-type': 'text/plain',
          'x-deny-reason': 'host_not_allowed',
        },
      },
      { json: true },
    );

    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.error.headers).toEqual({
      'content-type': 'text/plain',
      'x-deny-reason': 'host_not_allowed',
    });
  });

  it('omits statusCode/headers/body keys when not provided', () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError(
      { message: 'bad input', code: 'invalid_options' },
      { json: true },
    );

    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed).toEqual({
      error: { message: 'bad input', code: 'invalid_options' },
    });
  });

  it('does not append TTY hint line when statusCode is absent', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    outputError({ message: 'bad input', code: 'invalid_options' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).not.toMatch(/HTTP/);
  });
});
