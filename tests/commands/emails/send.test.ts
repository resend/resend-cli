import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { join } from 'node:path';

class ExitError extends Error {
  constructor(public code: number) { super(`process.exit(${code})`); }
}

const mockSend = mock(async () => ({
  data: { id: 'test-email-id-123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { send: mockSend };
    domains = { list: mock(async () => ({ data: { data: [] }, error: null })) };
  },
}));

describe('send command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

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
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
  });

  test('sends email with all flags provided', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test', '--text', 'Hello'],
      { from: 'user' }
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as any;
    expect(callArgs.from).toBe('a@test.com');
    expect(callArgs.to).toEqual(['b@test.com']);
    expect(callArgs.subject).toBe('Test');
    expect(callArgs.text).toBe('Hello');
  });

  test('outputs JSON with email ID on success', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test', '--text', 'Body'],
      { from: 'user' }
    );

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-email-id-123');
  });

  test('sends HTML email when --html provided', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test', '--html', '<h1>Hello</h1>'],
      { from: 'user' }
    );

    const callArgs = mockSend.mock.calls[0][0] as any;
    expect(callArgs.html).toBe('<h1>Hello</h1>');
    expect(callArgs.text).toBeUndefined();
  });

  test('supports multiple --to addresses', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--from', 'a@test.com', '--to', 'b@test.com', 'c@test.com', '--subject', 'Test', '--text', 'Hi'],
      { from: 'user' }
    );

    const callArgs = mockSend.mock.calls[0][0] as any;
    expect(callArgs.to).toEqual(['b@test.com', 'c@test.com']);
  });

  test('errors when no API key and non-interactive', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    try {
      await sendCommand.parseAsync(
        ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test', '--text', 'Hi'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }
  });

  test('errors listing missing flags in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    try {
      await sendCommand.parseAsync(['--from', 'a@test.com'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
    }

    const allErrors = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(allErrors).toContain('--to');
    expect(allErrors).toContain('--subject');
  });

  test('errors when no body and non-interactive', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    try {
      await sendCommand.parseAsync(
        ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }
  });

  test('reads HTML body from --html-file', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const tmpFile = join(import.meta.dir, '__test_email.html');
    await Bun.write(tmpFile, '<h1>From file</h1>');

    try {
      const { sendCommand } = await import('../../../src/commands/emails/send');
      await sendCommand.parseAsync(
        ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test', '--html-file', tmpFile],
        { from: 'user' }
      );

      const callArgs = mockSend.mock.calls[0][0] as any;
      expect(callArgs.html).toBe('<h1>From file</h1>');
    } finally {
      const { unlinkSync } = require('node:fs');
      unlinkSync(tmpFile);
    }
  });

  test('passes cc, bcc, reply-to when provided', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test', '--text', 'Body',
        '--cc', 'cc@test.com', '--bcc', 'bcc@test.com', '--reply-to', 'reply@test.com',
      ],
      { from: 'user' }
    );

    const callArgs = mockSend.mock.calls[0][0] as any;
    expect(callArgs.cc).toEqual(['cc@test.com']);
    expect(callArgs.bcc).toEqual(['bcc@test.com']);
    expect(callArgs.replyTo).toBe('reply@test.com');
  });
});
