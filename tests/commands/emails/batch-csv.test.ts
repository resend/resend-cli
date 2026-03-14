import { writeFileSync } from 'node:fs';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('batch-csv command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpFile: string;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockBatchSend.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
    if (tmpFile) {
      try {
        require('node:fs').unlinkSync(tmpFile);
      } catch {}
      tmpFile = '';
    }
  });

  function writeTmpCsv(name: string, content: string): string {
    const path = join(__dirname, name);
    writeFileSync(path, content);
    tmpFile = path;
    return path;
  }

  test('sends emails from CSV with template', async () => {
    spies = setupOutputSpies();

    const csv =
      'to,first_name,plan\nalice@example.com,Alice,pro\nbob@example.com,Bob,free';
    const file = writeTmpCsv('__test_batchcsv.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      ['--file', file, '--template-id', 'tmpl_abc', '--from', 'you@domain.com'],
      { from: 'user' },
    );

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const emails = mockBatchSend.mock.calls[0][0] as unknown[];
    expect(emails).toHaveLength(2);

    // Check that template variables are passed
    const first = emails[0] as Record<string, unknown>;
    expect(first.to).toBe('alice@example.com');
    expect(first.from).toBe('you@domain.com');
    expect(first.template).toEqual({
      id: 'tmpl_abc',
      variables: { first_name: 'Alice', plan: 'pro' },
    });
  });

  test('sends emails from CSV with inline text and interpolation', async () => {
    spies = setupOutputSpies();

    const csv = 'to,name\nalice@example.com,Alice\nbob@example.com,Bob';
    const file = writeTmpCsv('__test_batchcsv_inline.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      [
        '--file',
        file,
        '--from',
        'you@domain.com',
        '--subject',
        'Hello {{name}}',
        '--text',
        'Hi {{name}}, welcome!',
      ],
      { from: 'user' },
    );

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const emails = mockBatchSend.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;

    expect(emails[0].subject).toBe('Hello Alice');
    expect(emails[0].text).toBe('Hi Alice, welcome!');
    expect(emails[1].subject).toBe('Hello Bob');
    expect(emails[1].text).toBe('Hi Bob, welcome!');
  });

  test('uses custom --to-column', async () => {
    spies = setupOutputSpies();

    const csv =
      'email,first_name\nalice@example.com,Alice\nbob@example.com,Bob';
    const file = writeTmpCsv('__test_batchcsv_col.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      [
        '--file',
        file,
        '--template-id',
        'tmpl_abc',
        '--from',
        'you@domain.com',
        '--to-column',
        'email',
      ],
      { from: 'user' },
    );

    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    const emails = mockBatchSend.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(emails[0].to).toBe('alice@example.com');
  });

  test('auto-chunks when over 100 rows', async () => {
    spies = setupOutputSpies();

    const header = 'to,name';
    const rows = Array.from(
      { length: 150 },
      (_, i) => `user${i}@example.com,User${i}`,
    );
    const csv = [header, ...rows].join('\n');
    const file = writeTmpCsv('__test_batchcsv_chunk.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      ['--file', file, '--template-id', 'tmpl_abc', '--from', 'you@domain.com'],
      { from: 'user' },
    );

    // Should be called twice: 100 + 50
    expect(mockBatchSend).toHaveBeenCalledTimes(2);
    const chunk1 = mockBatchSend.mock.calls[0][0] as unknown[];
    const chunk2 = mockBatchSend.mock.calls[1][0] as unknown[];
    expect(chunk1).toHaveLength(100);
    expect(chunk2).toHaveLength(50);
  });

  test('outputs JSON result with sent count and ids', async () => {
    spies = setupOutputSpies();

    const csv = 'to,name\nalice@example.com,Alice\nbob@example.com,Bob';
    const file = writeTmpCsv('__test_batchcsv_json.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      ['--file', file, '--template-id', 'tmpl_abc', '--from', 'you@domain.com'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.sent).toBe(2);
    expect(parsed.ids).toEqual([{ id: 'abc123' }, { id: 'def456' }]);
    expect(parsed.chunks).toBe(1);
  });

  test('errors with missing_file when no --file in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await expectExit1(() =>
      batchCsvCommand.parseAsync(
        ['--template-id', 'tmpl_abc', '--from', 'you@domain.com'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_file');
  });

  test('errors with missing_body when no template/html/text', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const csv = 'to,name\nalice@example.com,Alice';
    const file = writeTmpCsv('__test_batchcsv_nobody.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await expectExit1(() =>
      batchCsvCommand.parseAsync(
        ['--file', file, '--from', 'you@domain.com', '--subject', 'Hi'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_body');
  });

  test('errors with missing_column when to-column not found', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const csv = 'email,name\nalice@example.com,Alice';
    const file = writeTmpCsv('__test_batchcsv_nocol.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await expectExit1(() =>
      batchCsvCommand.parseAsync(
        [
          '--file',
          file,
          '--template-id',
          'tmpl_abc',
          '--from',
          'you@domain.com',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_column');
  });

  test('passes tags to all emails', async () => {
    spies = setupOutputSpies();

    const csv = 'to,name\nalice@example.com,Alice';
    const file = writeTmpCsv('__test_batchcsv_tags.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      [
        '--file',
        file,
        '--template-id',
        'tmpl_abc',
        '--from',
        'you@domain.com',
        '--tags',
        'category=marketing',
      ],
      { from: 'user' },
    );

    const emails = mockBatchSend.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    expect(emails[0].tags).toEqual([{ name: 'category', value: 'marketing' }]);
  });

  test('passes batch-validation option', async () => {
    spies = setupOutputSpies();

    const csv = 'to,name\nalice@example.com,Alice';
    const file = writeTmpCsv('__test_batchcsv_validation.csv', csv);

    const { batchCsvCommand } = await import(
      '../../../src/commands/emails/batch-csv'
    );
    await batchCsvCommand.parseAsync(
      [
        '--file',
        file,
        '--template-id',
        'tmpl_abc',
        '--from',
        'you@domain.com',
        '--batch-validation',
        'permissive',
      ],
      { from: 'user' },
    );

    const opts = mockBatchSend.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.batchValidation).toBe('permissive');
  });
});
