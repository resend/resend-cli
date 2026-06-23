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

const contactImport = {
  object: 'contact_import',
  id: '479e3145-dd38-476b-932c-529ceb705947',
  status: 'completed',
  created_at: '2026-05-15T18:32:37.823Z',
  completed_at: '2026-05-15T18:33:42.916Z',
  counts: { total: 1200, created: 800, updated: 300, skipped: 75, failed: 25 },
};

const mockList = vi.fn(async () => ({
  data: { object: 'list', has_more: false, data: [contactImport] },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { imports: { list: mockList } };
  },
}));

describe('contacts imports list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('calls SDK imports.list with the default limit and outputs JSON', async () => {
    spies = setupOutputSpies();

    const { listContactImportsCommand } = await import(
      '../../../../src/commands/contacts/imports/list'
    );
    await listContactImportsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledWith({ limit: 10 });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].id).toBe('479e3145-dd38-476b-932c-529ceb705947');
  });

  it('passes --status filter to the SDK', async () => {
    spies = setupOutputSpies();

    const { listContactImportsCommand } = await import(
      '../../../../src/commands/contacts/imports/list'
    );
    await listContactImportsCommand.parseAsync(['--status', 'completed'], {
      from: 'user',
    });

    expect(mockList).toHaveBeenCalledWith({ limit: 10, status: 'completed' });
  });

  it('passes --after cursor to the SDK', async () => {
    spies = setupOutputSpies();

    const { listContactImportsCommand } = await import(
      '../../../../src/commands/contacts/imports/list'
    );
    await listContactImportsCommand.parseAsync(
      ['--after', '479e3145-dd38-476b-932c-529ceb705947'],
      { from: 'user' },
    );

    expect(mockList).toHaveBeenCalledWith({
      limit: 10,
      after: '479e3145-dd38-476b-932c-529ceb705947',
    });
  });

  it('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactImportsCommand } = await import(
      '../../../../src/commands/contacts/imports/list'
    );
    await expectExit1(() =>
      listContactImportsCommand.parseAsync(['--limit', '999'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  it('errors with list_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(mockSdkError('Boom', 'application_error'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactImportsCommand } = await import(
      '../../../../src/commands/contacts/imports/list'
    );
    await expectExit1(() =>
      listContactImportsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
