import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import * as files from '../../../src/lib/files';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockBatchSend = vi.fn(async () => ({
  data: { data: [{ id: 'abc123' }, { id: 'def456' }] },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    batch = { send: mockBatchSend };
  },
}));

const mockBuildReactEmailHtml = vi.fn(
  async () => '<html><body>Rendered</body></html>',
);

vi.mock('../../../src/lib/react-email', () => ({
  buildReactEmailHtml: (...args: unknown[]) => mockBuildReactEmailHtml(...args),
}));

const VALID_EMAILS = [
  {
    from: 'you@domain.com',
    to: ['user1@example.com'],
    subject: 'Hello 1',
    html: '<p>Hello 1</p>',
  },
  {
    from: 'you@domain.com',
    to: ['user2@example.com'],
    subject: 'Hello 2',
    text: 'Hello 2',
  },
];

describe('batch command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let readFileSpy: MockInstance | undefined;
  let tmpFile: string;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockBatchSend.mockClear();
    mockBuildReactEmailHtml.mockClear();
  });

  afterEach(async () => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    readFileSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
    readFileSpy = undefined;
    if (tmpFile) {
      const { unlinkSync } = require('node:fs');
      try {
        unlinkSync(tmpFile);
      } catch {}
      tmpFile = '';
    }
  });

  async function writeTmpJson(content: unknown): Promise<string> {
    const path = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_batch.json',
    );
    writeFileSync(path, JSON.stringify(content));
    tmpFile = path;
    return path;
  }

  test('sends emails from a JSON file', async () => {
    spies = setupOutputSpies();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const emails = mockBatchSend.mock.calls[0][0] as unknown[];
    expect(emails).toHaveLength(2);
  });

  test('outputs array of IDs on success in JSON mode', async () => {
    // Non-interactive mode (no TTY) automatically triggers JSON output via outputResult
    spies = setupOutputSpies();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([{ id: 'abc123' }, { id: 'def456' }]);
  });

  test('errors with missing_file when no --file in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() => batchCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_file');
  });

  test('errors with file_read_error when file does not exist', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(
        ['--file', '/tmp/nonexistent-resend-batch.json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });

  test('errors with invalid_json when file is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const path = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_batch_bad.json',
    );
    writeFileSync(path, 'not valid json{{{');
    tmpFile = path;

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(['--file', path], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_json');
  });

  test('errors with invalid_format when file content is not an array', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const file = await writeTmpJson({
      from: 'you@domain.com',
      to: ['user@example.com'],
    });
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(['--file', file], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_format');
    // Regression: invalid_format check was inside the try block; ExitError thrown by
    // outputError (when process.exit is mocked) would be caught, firing invalid_json too.
    expect(output).not.toContain('invalid_json');
  });

  test('rejects entries with attachments', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const emails = [
      {
        ...VALID_EMAILS[0],
        attachments: [{ filename: 'test.txt', content: 'hello' }],
      },
    ];
    const file = await writeTmpJson(emails);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(['--file', file], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('attachments');
  });

  test('rejects entries with scheduled_at', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const emails = [
      { ...VALID_EMAILS[0], scheduled_at: '2026-01-01T00:00:00Z' },
    ];
    const file = await writeTmpJson(emails);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(['--file', file], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('scheduled_at');
  });

  test('warns but continues when array length exceeds 100', async () => {
    spies = setupOutputSpies();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
    spies = setupOutputSpies();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(
      ['--file', file, '--idempotency-key', 'my-key-123'],
      { from: 'user' },
    );

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const opts = mockBatchSend.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.idempotencyKey).toBe('my-key-123');
  });

  test('passes batchValidation to batch.send options', async () => {
    spies = setupOutputSpies();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(
      ['--file', file, '--batch-validation', 'permissive'],
      { from: 'user' },
    );

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const opts = mockBatchSend.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.batchValidation).toBe('permissive');
  });

  test('errors with auth_error when no API key in non-interactive mode', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(['--file', file], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('outputs human-readable summary in terminal mode', async () => {
    // Make it look like a TTY so outputResult uses human-readable format
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    const allOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('2');
    expect(allOutput).toContain('abc123');
    expect(allOutput).toContain('def456');

    logSpy.mockRestore();
  });

  test('surfaces partial errors in permissive mode (JSON output)', async () => {
    spies = setupOutputSpies();

    mockBatchSend.mockImplementationOnce(async () => ({
      data: {
        data: [{ id: 'abc123' }],
        errors: [{ index: 1, message: 'Invalid email address' }],
      },
      error: null,
    }));

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(
      ['--file', file, '--batch-validation', 'permissive'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.data).toEqual([{ id: 'abc123' }]);
    expect(parsed.errors).toEqual([
      { index: 1, message: 'Invalid email address' },
    ]);
  });

  test('does not include errors key in JSON output when no batch errors', async () => {
    spies = setupOutputSpies();

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', file], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    // When no errors, output should be the plain array (no wrapper object)
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([{ id: 'abc123' }, { id: 'def456' }]);
  });

  test('--file - passes stdin to readFile', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue(JSON.stringify(VALID_EMAILS));

    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(['--file', '-'], { from: 'user' });

    expect(readFileSpy).toHaveBeenCalledWith('-', expect.anything());
    expect(mockBatchSend).toHaveBeenCalledTimes(1);
  });

  test('injects rendered HTML from --react-email into all batch emails', async () => {
    spies = setupOutputSpies();

    const emailsWithoutHtml = [
      {
        from: 'you@domain.com',
        to: ['user1@example.com'],
        subject: 'Hello 1',
      },
      {
        from: 'you@domain.com',
        to: ['user2@example.com'],
        subject: 'Hello 2',
      },
    ];
    const file = await writeTmpJson(emailsWithoutHtml);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await batchCommand.parseAsync(
      ['--file', file, '--react-email', './emails/welcome.tsx'],
      { from: 'user' },
    );

    expect(mockBuildReactEmailHtml).toHaveBeenCalledWith(
      './emails/welcome.tsx',
      expect.anything(),
    );
    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const emails = mockBatchSend.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    for (const email of emails) {
      expect(email.html).toBe('<html><body>Rendered</body></html>');
    }
  });

  test('errors with batch_error when SDK returns an error', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    mockBatchSend.mockImplementationOnce(async () => ({
      data: null,
      error: { message: 'Something went wrong', name: 'application_error' },
    }));

    const file = await writeTmpJson(VALID_EMAILS);
    const { batchCommand } = await import('../../../src/commands/emails/batch');
    await expectExit1(() =>
      batchCommand.parseAsync(['--file', file], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('batch_error');
  });
});
