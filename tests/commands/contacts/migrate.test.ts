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

const mockSegmentAdd = vi.fn(async () => ({
  data: { id: 'membership-123' },
  error: null,
}));

const mockSegmentRemove = vi.fn(async () => ({
  data: { id: 'seg-456', deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      segments: {
        add: mockSegmentAdd,
        remove: mockSegmentRemove,
      },
    };
  },
}));

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('contacts migrate command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpFile: string;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSegmentAdd.mockClear();
    mockSegmentRemove.mockClear();
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

  function writeTmpFile(name: string, content: string): string {
    const path = join(__dirname, name);
    writeFileSync(path, content);
    tmpFile = path;
    return path;
  }

  test('migrates contacts from CSV (add-only)', async () => {
    spies = setupOutputSpies();

    const csv = 'email\nalice@example.com\nbob@example.com';
    const file = writeTmpFile('__test_migrate.csv', csv);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      ['--file', file, '--to-segment', 'seg-target', '--yes'],
      { from: 'user' },
    );

    expect(mockSegmentAdd).toHaveBeenCalledTimes(2);
    expect(mockSegmentRemove).not.toHaveBeenCalled();

    // Verify the payloads
    const call1 = mockSegmentAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(call1.email).toBe('alice@example.com');
    expect(call1.segmentId).toBe('seg-target');
  });

  test('migrates contacts with from-segment (move)', async () => {
    spies = setupOutputSpies();

    const csv = 'email\nalice@example.com';
    const file = writeTmpFile('__test_migrate_move.csv', csv);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      [
        '--file',
        file,
        '--to-segment',
        'seg-target',
        '--from-segment',
        'seg-source',
        '--yes',
      ],
      { from: 'user' },
    );

    expect(mockSegmentAdd).toHaveBeenCalledTimes(1);
    expect(mockSegmentRemove).toHaveBeenCalledTimes(1);

    const removeCall = mockSegmentRemove.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(removeCall.segmentId).toBe('seg-source');
  });

  test('accepts JSON array of strings', async () => {
    spies = setupOutputSpies();

    const json = JSON.stringify(['alice@example.com', 'bob@example.com']);
    const file = writeTmpFile('__test_migrate.json', json);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      ['--file', file, '--to-segment', 'seg-target', '--yes'],
      { from: 'user' },
    );

    expect(mockSegmentAdd).toHaveBeenCalledTimes(2);
  });

  test('accepts JSON array of objects', async () => {
    spies = setupOutputSpies();

    const json = JSON.stringify([
      { email: 'alice@example.com' },
      { email: 'bob@example.com' },
    ]);
    const file = writeTmpFile('__test_migrate_obj.json', json);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      ['--file', file, '--to-segment', 'seg-target', '--yes'],
      { from: 'user' },
    );

    expect(mockSegmentAdd).toHaveBeenCalledTimes(2);
  });

  test('uses custom --column for CSV', async () => {
    spies = setupOutputSpies();

    const csv = 'contact_id,name\nuuid-123,Alice\nuuid-456,Bob';
    const file = writeTmpFile('__test_migrate_col.csv', csv);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      [
        '--file',
        file,
        '--to-segment',
        'seg-target',
        '--column',
        'contact_id',
        '--yes',
      ],
      { from: 'user' },
    );

    expect(mockSegmentAdd).toHaveBeenCalledTimes(2);
    const call1 = mockSegmentAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(call1.contactId).toBe('uuid-123');
  });

  test('errors with missing_file when no --file in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await expectExit1(() =>
      migrateContactsCommand.parseAsync(
        ['--to-segment', 'seg-target', '--yes'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_file');
  });

  test('errors with missing_column when column not found', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const csv = 'name,address\nAlice,alice@example.com';
    const file = writeTmpFile('__test_migrate_nocol.csv', csv);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await expectExit1(() =>
      migrateContactsCommand.parseAsync(
        ['--file', file, '--to-segment', 'seg-target', '--yes'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_column');
  });

  test('outputs JSON result with migrated/failed counts', async () => {
    spies = setupOutputSpies();

    const csv = 'email\nalice@example.com\nbob@example.com';
    const file = writeTmpFile('__test_migrate_json.csv', csv);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      ['--file', file, '--to-segment', 'seg-target', '--yes'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.migrated).toBe(2);
    expect(parsed.failed).toBe(0);
    expect(parsed.total).toBe(2);
  });

  test('reports partial failures in JSON output', async () => {
    mockSegmentAdd
      .mockImplementationOnce(async () => ({
        data: { id: 'ok' },
        error: null,
      }))
      .mockImplementationOnce(async () => ({
        data: null,
        error: { message: 'Contact not found' },
      }));

    spies = setupOutputSpies();

    const csv = 'email\nalice@example.com\nbob@example.com';
    const file = writeTmpFile('__test_migrate_partial.csv', csv);

    const { migrateContactsCommand } = await import(
      '../../../src/commands/contacts/migrate'
    );
    await migrateContactsCommand.parseAsync(
      ['--file', file, '--to-segment', 'seg-target', '--yes'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.migrated).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].contact).toBe('bob@example.com');
  });
});
