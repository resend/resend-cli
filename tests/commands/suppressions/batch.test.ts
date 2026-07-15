import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockBatchAdd = vi.fn(async () => ({
  data: { data: [{ object: 'suppression', id: 'sup-1' }] },
  error: null,
}));
const mockBatchRemove = vi.fn(async () => ({
  data: { data: [{ object: 'suppression', id: 'sup-1', deleted: true }] },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    suppressions = { batch: { add: mockBatchAdd, remove: mockBatchRemove } };
  },
}));

describe('suppressions batch commands', () => {
  const restoreEnv = captureTestEnv();
  let _spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpFile: string;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockBatchAdd.mockClear();
    mockBatchRemove.mockClear();
    tmpFile = join(tmpdir(), `resend-sup-batch-${process.pid}.json`);
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    _spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
    try {
      unlinkSync(tmpFile);
    } catch {}
  });

  it('batch add sends the email list from the file', async () => {
    writeFileSync(tmpFile, JSON.stringify(['a@example.com', 'b@example.com']));
    _spies = setupOutputSpies();

    const { batchAddSuppressionsCommand } = await import(
      '../../../src/commands/suppressions/batch/add'
    );
    await batchAddSuppressionsCommand.parseAsync(['--file', tmpFile], {
      from: 'user',
    });

    expect(mockBatchAdd).toHaveBeenCalledWith({
      emails: ['a@example.com', 'b@example.com'],
    });
  });

  it('batch remove defaults to emails', async () => {
    writeFileSync(tmpFile, JSON.stringify(['a@example.com']));
    _spies = setupOutputSpies();

    const { batchRemoveSuppressionsCommand } = await import(
      '../../../src/commands/suppressions/batch/remove'
    );
    await batchRemoveSuppressionsCommand.parseAsync(['--file', tmpFile], {
      from: 'user',
    });

    expect(mockBatchRemove).toHaveBeenCalledWith({ emails: ['a@example.com'] });
  });

  it('batch remove --ids treats entries as ids', async () => {
    writeFileSync(tmpFile, JSON.stringify(['sup-1', 'sup-2']));
    _spies = setupOutputSpies();

    const { batchRemoveSuppressionsCommand } = await import(
      '../../../src/commands/suppressions/batch/remove'
    );
    await batchRemoveSuppressionsCommand.parseAsync(
      ['--file', tmpFile, '--ids'],
      { from: 'user' },
    );

    expect(mockBatchRemove).toHaveBeenCalledWith({ ids: ['sup-1', 'sup-2'] });
  });

  it('errors with invalid_format when the file is not an array of strings', async () => {
    writeFileSync(tmpFile, JSON.stringify([{ email: 'a@example.com' }]));
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchAddSuppressionsCommand } = await import(
      '../../../src/commands/suppressions/batch/add'
    );
    await expectExit1(() =>
      batchAddSuppressionsCommand.parseAsync(['--file', tmpFile], {
        from: 'user',
      }),
    );

    expect(mockBatchAdd).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_format');
  });

  it('errors with missing_file when no --file in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { batchAddSuppressionsCommand } = await import(
      '../../../src/commands/suppressions/batch/add'
    );
    await expectExit1(() =>
      batchAddSuppressionsCommand.parseAsync([], { from: 'user' }),
    );

    expect(mockBatchAdd).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_file');
  });
});
