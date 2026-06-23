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

const mockGet = vi.fn(async () => ({ data: contactImport, error: null }));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { imports: { get: mockGet } };
  },
}));

describe('contacts imports get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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
  });

  it('calls SDK imports.get with the id and outputs JSON', async () => {
    spies = setupOutputSpies();

    const { getContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/get'
    );
    await getContactImportCommand.parseAsync(
      ['479e3145-dd38-476b-932c-529ceb705947'],
      { from: 'user' },
    );

    expect(mockGet).toHaveBeenCalledWith(
      '479e3145-dd38-476b-932c-529ceb705947',
    );
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_import');
    expect(parsed.status).toBe('completed');
    expect(parsed.counts.total).toBe(1200);
  });

  it('errors with fetch_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Contact import not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getContactImportCommand } = await import(
      '../../../../src/commands/contacts/imports/get'
    );
    await expectExit1(() =>
      getContactImportCommand.parseAsync(
        ['479e3145-dd38-476b-932c-529ceb705947'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
