import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { sendInboxDraftCommand } from '../../../../src/commands/inboxes/drafts/send';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const DRAFT_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';

const mockSend = vi.fn(async () => ({
  data: {
    object: 'inbox_draft' as const,
    id: DRAFT_ID,
    thread_id: THREAD_ID,
    email_id: EMAIL_ID,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { drafts: { send: mockSend } };
  },
}));

describe('inboxes drafts send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('sends a draft and outputs JSON with email_id', async () => {
    spies = setupOutputSpies();

    await sendInboxDraftCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
      {
        from: 'user',
      },
    );

    expect(mockSend).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.email_id).toBe(EMAIL_ID);
    expect(parsed.thread_id).toBe(THREAD_ID);
  });

  it('errors with send_error when SDK returns an error', async () => {
    setNonInteractive();
    mockSend.mockResolvedValueOnce(
      mockSdkError('Draft has no recipients.', 'validation_error') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      sendInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('send_error');
  });
});
