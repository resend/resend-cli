import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { deleteInboxCommand } from '../../../src/commands/inboxes/delete';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockRemove = vi.fn(async () => ({
  data: { object: 'inbox' as const, id: INBOX_ID, deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { remove: mockRemove };
  },
}));

describe('inboxes delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('deletes inbox with --yes flag', async () => {
    spies = setupOutputSpies();

    await deleteInboxCommand.parseAsync([INBOX_ID, '--yes'], { from: 'user' });

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe(INBOX_ID);
  });

  it('outputs synthesized JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    await deleteInboxCommand.parseAsync([INBOX_ID, '--yes'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('inbox');
    expect(parsed.id).toBe(INBOX_ID);
    expect(parsed.deleted).toBe(true);
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      deleteInboxCommand.parseAsync([INBOX_ID], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('Inbox not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      deleteInboxCommand.parseAsync([INBOX_ID, '--yes'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
