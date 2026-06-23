import { unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const mockCreate = vi.fn(async () => ({
  data: {
    object: 'contact_import' as const,
    id: '479e3145-dd38-476b-932c-529ceb705947',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { imports: { create: mockCreate } };
  },
}));

const tmpFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '__test_contacts.csv',
);

describe('contacts imports create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
    writeFileSync(tmpFile, 'email,first_name\njane@example.com,Jane\n');
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
    try {
      unlinkSync(tmpFile);
    } catch {
      // already removed
    }
  });

  it('reads the CSV file and passes it to the SDK as a File', async () => {
    spies = setupOutputSpies();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await createContactImportCommand.parseAsync(['--file', tmpFile], {
      from: 'user',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as { file: File };
    expect(args.file).toBeInstanceOf(File);
    expect(args.file.name).toBe('__test_contacts.csv');
  });

  it('outputs JSON contact_import id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await createContactImportCommand.parseAsync(['--file', tmpFile], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('479e3145-dd38-476b-932c-529ceb705947');
    expect(parsed.object).toBe('contact_import');
  });

  it('parses --column-map JSON and passes it to the SDK', async () => {
    spies = setupOutputSpies();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await createContactImportCommand.parseAsync(
      [
        '--file',
        tmpFile,
        '--column-map',
        '{"email":"Email","firstName":"First Name"}',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.columnMap).toEqual({
      email: 'Email',
      firstName: 'First Name',
    });
  });

  it('passes --on-conflict to the SDK', async () => {
    spies = setupOutputSpies();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await createContactImportCommand.parseAsync(
      ['--file', tmpFile, '--on-conflict', 'skip'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.onConflict).toBe('skip');
  });

  it('maps multiple --segment-id values to a segments array', async () => {
    spies = setupOutputSpies();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await createContactImportCommand.parseAsync(
      [
        '--file',
        tmpFile,
        '--segment-id',
        '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
        '--segment-id',
        'e8d7c6b5-a4f3-2e1d-0c9b-8a7f6e5d4c3b',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.segments).toEqual([
      { id: '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c' },
      { id: 'e8d7c6b5-a4f3-2e1d-0c9b-8a7f6e5d4c3b' },
    ]);
  });

  it('parses --topics JSON and passes it to the SDK', async () => {
    spies = setupOutputSpies();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await createContactImportCommand.parseAsync(
      [
        '--file',
        tmpFile,
        '--topics',
        '[{"id":"b6d24b8e-af0b-4c3c-be0c-359bbd97381e","subscription":"opt_in"}]',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.topics).toEqual([
      { id: 'b6d24b8e-af0b-4c3c-be0c-359bbd97381e', subscription: 'opt_in' },
    ]);
  });

  it('errors with missing_file in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await expectExit1(() =>
      createContactImportCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_file');
  });

  it('errors with file_read_error when the file does not exist', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await expectExit1(() =>
      createContactImportCommand.parseAsync(
        ['--file', '/tmp/nonexistent-resend-contacts.csv'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });

  it('errors with invalid_column_map when --column-map is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await expectExit1(() =>
      createContactImportCommand.parseAsync(
        ['--file', tmpFile, '--column-map', 'not-json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_column_map');
  });

  it('errors with invalid_column_map when --column-map is valid JSON but not an object', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await expectExit1(() =>
      createContactImportCommand.parseAsync(
        ['--file', tmpFile, '--column-map', '["email"]'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_column_map');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with create_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('File too large', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/create'
    );
    await expectExit1(() =>
      createContactImportCommand.parseAsync(['--file', tmpFile], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
