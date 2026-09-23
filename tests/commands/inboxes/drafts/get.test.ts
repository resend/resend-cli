import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { getInboxDraftCommand } from '../../../../src/commands/inboxes/drafts/get';
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

const mockGet = vi.fn(async () => ({
  data: {
    object: 'inbox_draft' as const,
    id: DRAFT_ID,
    type: 'standalone' as const,
    to: ['user@example.com'],
    cc: [],
    bcc: [],
    subject: 'Hello',
    html: null,
    text: 'Draft body',
    thread_id: null,
    reply_to_email_id: null,
    email_id: null,
    created_at: '2026-09-15T00:00:00.000Z',
    updated_at: '2026-09-15T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { drafts: { get: mockGet } };
  },
}));

describe('inboxes drafts get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('fetches a draft and outputs JSON', async () => {
    spies = setupOutputSpies();

    await getInboxDraftCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
      {
        from: 'user',
      },
    );

    expect(mockGet).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe(DRAFT_ID);
    expect(parsed.text).toBe('Draft body');
  });

  it('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Draft not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      getInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
