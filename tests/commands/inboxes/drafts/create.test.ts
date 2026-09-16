import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { createInboxDraftCommand } from '../../../../src/commands/inboxes/drafts/create';
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

const mockCreate = vi.fn(async () => ({
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
    inboxes = { drafts: { create: mockCreate } };
  },
}));

describe('inboxes drafts create command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('creates a standalone draft', async () => {
    setupOutputSpies();

    await createInboxDraftCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--to',
        'user@example.com',
        '--subject',
        'Hello',
        '--text',
        'Draft body',
      ],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.to).toEqual(['user@example.com']);
    expect(args.subject).toBe('Hello');
    expect(args.text).toBe('Draft body');
    expect(args.threadId).toBeUndefined();
  });

  it('creates a reply draft with paired thread flags', async () => {
    setupOutputSpies();

    await createInboxDraftCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--text',
        'Reply body',
        '--thread-id',
        THREAD_ID,
        '--reply-to-email-id',
        EMAIL_ID,
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.threadId).toBe(THREAD_ID);
    expect(args.replyToEmailId).toBe(EMAIL_ID);
  });

  it('errors with invalid_options when --thread-id lacks --reply-to-email-id', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxDraftCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--text', 'x', '--thread-id', THREAD_ID],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with missing_content when no content field is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxDraftCommand.parseAsync(['--inbox-id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_content');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Thread not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxDraftCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--text', 'x'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
