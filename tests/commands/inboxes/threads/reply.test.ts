import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { replyInboxThreadEmailCommand } from '../../../../src/commands/inboxes/threads/emails/reply';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';
const REPLY_ID = '9f3b5a1e-2c4d-4e6f-8a0b-1c2d3e4f5a6b';

const mockReply = vi.fn(async () => ({
  data: {
    id: REPLY_ID,
    email_id: REPLY_ID,
    direction: 'outbound' as const,
    from: 'support@acme.dev',
    to: ['customer@example.com'],
    cc: [],
    bcc: [],
    reply_to: [],
    subject: 'Re: Billing question',
    message_id: null,
    html: null,
    text: 'You were only charged once.',
    attachments: [],
    read: true,
    received_at: '2026-09-15T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { emails: { reply: mockReply } } };
  },
}));

describe('inboxes threads emails reply command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockReply.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('sends a text reply', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [INBOX_ID, THREAD_ID, EMAIL_ID, '--text', 'You were only charged once.'],
      { from: 'user' },
    );

    expect(mockReply).toHaveBeenCalledTimes(1);
    const args = mockReply.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.threadId).toBe(THREAD_ID);
    expect(args.emailId).toBe(EMAIL_ID);
    expect(args.text).toBe('You were only charged once.');
    expect(args.html).toBeUndefined();
  });

  it('passes --html and --subject to the SDK', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        INBOX_ID,
        THREAD_ID,
        EMAIL_ID,
        '--html',
        '<p>Done</p>',
        '--subject',
        'Re: hi',
      ],
      { from: 'user' },
    );

    const args = mockReply.mock.calls[0][0] as Record<string, unknown>;
    expect(args.html).toBe('<p>Done</p>');
    expect(args.subject).toBe('Re: hi');
  });

  it('outputs JSON with email_id when non-interactive', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [INBOX_ID, THREAD_ID, EMAIL_ID, '--text', 'ok'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.email_id).toBe(REPLY_ID);
    expect(parsed.direction).toBe('outbound');
  });

  it('errors with missing_content when neither --text nor --html given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      replyInboxThreadEmailCommand.parseAsync([INBOX_ID, THREAD_ID, EMAIL_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_content');
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockReply.mockResolvedValueOnce(
      mockSdkError('Email not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      replyInboxThreadEmailCommand.parseAsync(
        [INBOX_ID, THREAD_ID, EMAIL_ID, '--text', 'ok'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
