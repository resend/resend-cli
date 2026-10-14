import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
import { replyInboxThreadEmailCommand } from '../../../../../src/commands/inboxes/threads/emails/reply';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';
const REPLY_ID = '9f3b5a1e-2c4d-4e6f-8a0b-1c2d3e4f5a6b';
const IDS = { inboxId: INBOX_ID, threadId: THREAD_ID, emailId: EMAIL_ID };

const mockReply = vi.fn(async () => ({
  data: { id: REPLY_ID },
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
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'You were only charged once.',
      ],
      { from: 'user' },
    );

    expect(mockReply).toHaveBeenCalledTimes(1);
    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'You were only charged once.',
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('takes the IDs as positional arguments', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [INBOX_ID, THREAD_ID, EMAIL_ID, '--text', 'ok'],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({ ...IDS, text: 'ok' });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('accepts the snake_case ID flags', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--text',
        'ok',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({ ...IDS, text: 'ok' });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('gives the same --cc for the spaced and repeated forms', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        INBOX_ID,
        THREAD_ID,
        EMAIL_ID,
        '--cc',
        'a@example.com',
        'b@example.com',
        '--text',
        'ok',
      ],
      { from: 'user' },
    );
    await replyInboxThreadEmailCommand.parseAsync(
      [
        INBOX_ID,
        THREAD_ID,
        EMAIL_ID,
        '--cc',
        'a@example.com',
        '--cc',
        'b@example.com',
        '--text',
        'ok',
      ],
      { from: 'user' },
    );

    const expected = {
      ...IDS,
      text: 'ok',
      cc: ['a@example.com', 'b@example.com'],
    };
    expect(mockReply.mock.calls[0][0]).toStrictEqual(expected);
    expect(mockReply.mock.calls[1][0]).toStrictEqual(expected);
  });

  it('passes --html and --subject to the SDK', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--html',
        '<p>Done</p>',
        '--subject',
        'Re: hi',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      html: '<p>Done</p>',
      subject: 'Re: hi',
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('passes repeated --cc and --bcc to the SDK', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'Looping in finance.',
        '--cc',
        'finance@example.com',
        '--cc',
        'ops@example.com',
        '--bcc',
        'audit@example.com',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'Looping in finance.',
      cc: ['finance@example.com', 'ops@example.com'],
      bcc: ['audit@example.com'],
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('omits cc and bcc when the flags are absent', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'Thanks!',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'Thanks!',
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('passes --reply-all to the SDK as replyAll', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'Thanks, all.',
        '--reply-all',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'Thanks, all.',
      replyAll: true,
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('omits replyAll when --reply-all is absent', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'Thanks!',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'Thanks!',
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('outputs the sent email id as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'ok',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual({ id: REPLY_ID });
  });

  it('passes idempotencyKey as second arg to threads.emails.reply', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'ok',
        '--idempotency-key',
        'my-key-123',
      ],
      { from: 'user' },
    );

    expect(mockReply).toHaveBeenCalledTimes(1);
    expect(mockReply.mock.calls[0][0]).toStrictEqual({ ...IDS, text: 'ok' });
    expect(mockReply.mock.calls[0][1]).toStrictEqual({
      idempotencyKey: 'my-key-123',
    });
  });

  it('errors with missing_content when neither --text nor --html given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      replyInboxThreadEmailCommand.parseAsync(
        [
          '--inbox-id',
          INBOX_ID,
          '--thread-id',
          THREAD_ID,
          '--email-id',
          EMAIL_ID,
        ],
        {
          from: 'user',
        },
      ),
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
        [
          '--inbox-id',
          INBOX_ID,
          '--thread-id',
          THREAD_ID,
          '--email-id',
          EMAIL_ID,
          '--text',
          'ok',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
  it('reads --attachment files and --attachments-file into attachments', async () => {
    setupOutputSpies();
    const dir = mkdtempSync(join(tmpdir(), 'resend-inbox-attachments-'));
    const file = join(dir, 'notes.txt');
    const jsonFile = join(dir, 'attachments.json');
    writeFileSync(file, 'hello');
    writeFileSync(
      jsonFile,
      JSON.stringify([{ filename: 'extra.txt', content: 'aGk=' }]),
    );

    try {
      await replyInboxThreadEmailCommand.parseAsync(
        [
          '--inbox-id',
          INBOX_ID,
          '--thread-id',
          THREAD_ID,
          '--email-id',
          EMAIL_ID,
          '--text',
          'See attached.',
          '--attachment',
          file,
          'https://example.com/report.pdf;filename=report.pdf',
          '--attachments-file',
          jsonFile,
        ],
        { from: 'user' },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'See attached.',
      attachments: [
        { filename: 'notes.txt', content: Buffer.from('hello') },
        { path: 'https://example.com/report.pdf', filename: 'report.pdf' },
        { filename: 'extra.txt', content: 'aGk=' },
      ],
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('errors with file_read_error when an --attachment file is missing', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    mockReply.mockClear();

    await expectExit1(() =>
      replyInboxThreadEmailCommand.parseAsync(
        [
          '--inbox-id',
          INBOX_ID,
          '--thread-id',
          THREAD_ID,
          '--email-id',
          EMAIL_ID,
          '--text',
          'See attached.',
          '--attachment',
          '/tmp/nonexistent-resend-inbox-attachment.txt',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('passes --headers to the SDK', async () => {
    setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        'ok',
        '--headers',
        'X-Ticket-Id=4821',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: 'ok',
      headers: { 'X-Ticket-Id': '4821' },
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });

  it('errors with invalid_header for a header without =', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    mockReply.mockClear();

    await expectExit1(() =>
      replyInboxThreadEmailCommand.parseAsync(
        [
          '--inbox-id',
          INBOX_ID,
          '--thread-id',
          THREAD_ID,
          '--email-id',
          EMAIL_ID,
          '--text',
          'ok',
          '--headers',
          'X-Ticket-Id',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_header');
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('sends an explicit empty --text and --subject', async () => {
    spies = setupOutputSpies();

    await replyInboxThreadEmailCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--thread-id',
        THREAD_ID,
        '--email-id',
        EMAIL_ID,
        '--text',
        '',
        '--html',
        '<p>Hi</p>',
        '--subject',
        '',
      ],
      { from: 'user' },
    );

    expect(mockReply.mock.calls[0][0]).toStrictEqual({
      ...IDS,
      text: '',
      html: '<p>Hi</p>',
      subject: '',
    });
    expect(mockReply.mock.calls[0][1]).toBeUndefined();
  });
});
