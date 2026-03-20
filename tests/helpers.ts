import { expect, type MockInstance, vi } from 'vitest';
import { resetCredentialBackend } from '../src/lib/credential-store';

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

export function mockExitThrow(): MockInstance {
  return vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
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
    resetCredentialBackend();
  };
}

/**
 * Sets non-interactive mode and mocks console.log + process.stderr.write.
 * Returns the spies and a restore() function. Use in happy-path tests.
 */
export function setupOutputSpies() {
  setNonInteractive();
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);
  return { logSpy, stderrSpy };
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

export async function expectExitCode(
  code: number,
  fn: () => Promise<unknown>,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    expect(err).toBeInstanceOf(ExitError);
    expect((err as ExitError).code).toBe(code);
  }
  if (!threw) {
    throw new Error(
      `Expected command to exit with code ${code} but it completed successfully`,
    );
  }
}

export async function expectExit1(fn: () => Promise<unknown>): Promise<void> {
  return expectExitCode(1, fn);
}
