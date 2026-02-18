import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { join } from 'node:path';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockBatchSend = mock(async () => ({
  data: { data: [{ id: 'abc123' }, { id: 'def456' }] },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    batch = { send: mockBatchSend };
  },
}));

const VALID_EMAILS = [
  { from: 'you@domain.com', to: ['user1@example.com'], subject: 'Hello 1', html: '<p>Hello 1</p>' },
  { from: 'you@domain.com', to: ['user2@example.com'], subject: 'Hello 2', text: 'Hello 2' },
];

describe('batch command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;
  let tmpFile: string;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockBatchSend.mockClear();
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
    if (tmpFile) {
      const { unlinkSync } = require('node:fs');
      try { unlinkSync(tmpFile); } catch {}
      tmpFile = '';
    }
  });

  async function writeTmpJson(content: unknown): Promise<string> {
    const path = join(import.meta.dir, '__test_batch.json');
    await Bun.write(path, JSON.stringify(content));
    tmpFile = path;
    return path;
  }

  test('sends emails from a JSON file', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const emails = mockBatchSend.mock.calls[0][0] as unknown[];
    expect(emails).toHaveLength(2);
  });

  test('outputs array of IDs on success in JSON mode', async () => {
    // Non-interactive mode (no TTY) automatically triggers JSON output via outputResult
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([{ id: 'abc123' }, { id: 'def456' }]);
  });

  test('errors with missing_file when no --file in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_file');
  });

  test('errors with file_read_error when file does not exist', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', '/tmp/nonexistent-resend-batch.json'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });

  test('errors with invalid_json when file is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const path = join(import.meta.dir, '__test_batch_bad.json');
    await Bun.write(path, 'not valid json{{{');
    tmpFile = path;

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', path], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_json');
  });

  test('errors with invalid_format when file content is not an array', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const file = await writeTmpJson({ from: 'you@domain.com', to: ['user@example.com'] });
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', file], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_format');
    // Regression: invalid_format check was inside the try block; ExitError thrown by
    // outputError (when process.exit is mocked) would be caught, firing invalid_json too.
    expect(output).not.toContain('invalid_json');
  });

  test('rejects entries with attachments', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const emails = [
      { ...VALID_EMAILS[0], attachments: [{ filename: 'test.txt', content: 'hello' }] },
    ];
    const file = await writeTmpJson(emails);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', file], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('attachments');
  });

  test('rejects entries with scheduled_at', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const emails = [
      { ...VALID_EMAILS[0], scheduled_at: '2026-01-01T00:00:00Z' },
    ];
    const file = await writeTmpJson(emails);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', file], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('scheduled_at');
  });

  test('warns but continues when array length exceeds 100', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

    const emails = Array.from({ length: 101 }, (_, i) => ({
      from: 'you@domain.com',
      to: [`user${i}@example.com`],
      subject: `Hello ${i}`,
      text: `Hello ${i}`,
    }));
    const file = await writeTmpJson(emails);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    expect(mockBatchSend).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  test('passes idempotency key to batch.send', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file, '--idempotency-key', 'my-key-123'], { from: 'user' });

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const opts = mockBatchSend.mock.calls[0][1] as any;
    expect(opts?.idempotencyKey).toBe('my-key-123');
  });

  test('errors with auth_error when no API key in non-interactive mode', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', file], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('outputs human-readable summary in terminal mode', async () => {
    // Make it look like a TTY so outputResult uses human-readable format
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('2');
    expect(allOutput).toContain('abc123');
    expect(allOutput).toContain('def456');
  });

  test('errors with batch_error when SDK returns an error', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    mockBatchSend.mockImplementationOnce(async () => ({
      data: null,
      error: { message: 'Rate limit exceeded', name: 'rate_limit_exceeded' },
    }));

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    try {
      await batchCommand.parseAsync(['--file', file], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('batch_error');
  });
});
