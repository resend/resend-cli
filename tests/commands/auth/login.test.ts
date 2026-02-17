import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

class ExitError extends Error {
  constructor(public code: number) { super(`process.exit(${code})`); }
}

// Mock the Resend SDK
mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = {
      list: mock(async () => ({ data: { data: [] }, error: null })),
    };
  },
}));

describe('login command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let tmpDir: string;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;
  let logSpy: ReturnType<typeof spyOn>;

  function setNonInteractive() {
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
  }

  function mockExitThrow() {
    exitSpy = spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new ExitError(code ?? 0);
    });
  }

  beforeEach(() => {
    tmpDir = join(tmpdir(), `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
    logSpy?.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('rejects key not starting with re_', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    try {
      await loginCommand.parseAsync(['--key', 'bad_key'], { from: 'user' });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }
  });

  test('stores valid key to credentials.json', async () => {
    setNonInteractive();
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    logSpy = spyOn(console, 'log').mockImplementation(() => {});

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', 're_valid_test_key_123'], { from: 'user' });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.api_key).toBe('re_valid_test_key_123');
  });

  test('requires --key in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    try {
      await loginCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('missing_key');
  });
});
