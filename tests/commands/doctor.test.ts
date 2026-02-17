import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { Command } from '@commander-js/extra-typings';

class ExitError extends Error {
  constructor(public code: number) { super(`process.exit(${code})`); }
}

// Mock resend SDK for doctor
mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = {
      list: mock(async () => ({
        data: { data: [{ name: 'example.com', status: 'verified' }] },
        error: null,
      })),
    };
  },
}));

/**
 * Wraps doctorCommand in a parent program with global --json option,
 * matching the real CLI structure in src/cli.ts.
 */
async function createDoctorProgram() {
  const { doctorCommand } = await import('../../src/commands/doctor');
  const program = new Command()
    .name('resend')
    .option('--json', 'Force JSON output')
    .addCommand(doctorCommand);
  return program;
}

describe('doctor command', () => {
  const originalEnv = { ...process.env };
  const originalStdoutIsTTY = process.stdout.isTTY;
  const originalStdinIsTTY = process.stdin.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key_for_doctor';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    logSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
  });

  function setNonInteractive() {
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
  }

  test('outputs JSON with --json flag', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty('ok');
    expect(parsed).toHaveProperty('checks');
    expect(Array.isArray(parsed.checks)).toBe(true);
  });

  test('JSON output has correct check structure', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    for (const check of parsed.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('message');
      expect(['pass', 'warn', 'fail']).toContain(check.status);
    }
  });

  test('API key check passes when key is set', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    const keyCheck = parsed.checks.find((c: any) => c.name === 'API Key');

    expect(keyCheck).toBeDefined();
    expect(keyCheck.status).toBe('pass');
    expect(keyCheck.message).toContain('re_');
    expect(keyCheck.message).toContain('env');
  });

  test('API key check fails when no key is set', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';

    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.ok).toBe(false);
    const keyCheck = parsed.checks.find((c: any) => c.name === 'API Key');
    expect(keyCheck.status).toBe('fail');
  });

  test('masks API key in output', async () => {
    setNonInteractive();
    process.env.RESEND_API_KEY = 're_abcdefghijklmnop';
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    const keyCheck = parsed.checks.find((c: any) => c.name === 'API Key');

    // Should not contain full key
    expect(keyCheck.message).not.toContain('re_abcdefghijklmnop');
    // Should contain masked version (re_...mnop)
    expect(keyCheck.message).toContain('re_');
    expect(keyCheck.message).toContain('...');
  });

  test('exits with code 1 when checks fail', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';

    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new ExitError(code ?? 0);
    });
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const program = await createDoctorProgram();
    try {
      await program.parseAsync(['doctor', '--json'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }
  });
});
