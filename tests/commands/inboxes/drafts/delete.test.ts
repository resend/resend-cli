import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { deleteInboxDraftCommand } from '../../../../src/commands/inboxes/drafts/delete';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const DRAFT_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';

const mockRemove = vi.fn(async () => ({
  data: { object: 'inbox_draft' as const, id: DRAFT_ID, deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { drafts: { remove: mockRemove } };
  },
}));

describe('inboxes drafts delete command', () => {
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

  it('deletes a draft with --yes and outputs synthesized JSON', async () => {
    spies = setupOutputSpies();

    await deleteInboxDraftCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID, '--yes'],
      {
        from: 'user',
      },
    );

    expect(mockRemove).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('inbox_draft');
    expect(parsed.deleted).toBe(true);
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      deleteInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
