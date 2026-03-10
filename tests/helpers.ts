import { expect, spyOn } from 'bun:test';

export class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

export function setNonInteractive(): void {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: undefined,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: undefined,
    writable: true,
  });
}

export function mockExitThrow(): ReturnType<typeof spyOn> {
  return spyOn(process, 'exit').mockImplementation((code?: number) => {
    throw new ExitError(code ?? 0);
  });
}

/**
 * Captures current env and TTY state and returns a function that restores it.
 * Call once at the top of a describe block (not inside beforeEach) so state
 * is captured before any test runs.
 */
export function captureTestEnv(): () => void {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  return () => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalStdinIsTTY,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalStdoutIsTTY,
      writable: true,
    });
  };
}

/**
 * Sets non-interactive mode and mocks console.log + process.stderr.write.
 * Returns the spies and a restore() function. Use in happy-path tests.
 */
export function setupOutputSpies() {
  setNonInteractive();
  const logSpy = spyOn(console, 'log').mockImplementation(() => {});
  const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(
    () => true,
  );
  return {
    logSpy,
    stderrSpy,
    restore() {
      logSpy.mockRestore();
      stderrSpy.mockRestore();
    },
  };
}

/**
 * Asserts that fn throws ExitError with code 1.
 * Eliminates the expect(true).toBe(false) anti-pattern in error-path tests.
 */
/**
 * Returns a properly-typed SDK error response without needing `as any`.
 */
export function mockSdkError(message: string, name = 'error') {
  return { data: null, error: { message, name }, headers: null };
}

export async function expectExit1(fn: () => Promise<unknown>): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    expect(err).toBeInstanceOf(ExitError);
    expect((err as ExitError).code).toBe(1);
  }
  if (!threw) {
    throw new Error(
      'Expected command to exit with code 1 but it completed successfully',
    );
  }
}
