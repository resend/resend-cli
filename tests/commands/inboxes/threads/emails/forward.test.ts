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
import { forwardInboxThreadEmailCommand } from '../../../../../src/commands/inboxes/threads/emails/forward';
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
const FORWARD_ID = '9f3b5a1e-2c4d-4e6f-8a0b-1c2d3e4f5a6b';

const mockForward = vi.fn(async () => ({
  data: { id: FORWARD_ID },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { emails: { forward: mockForward } } };
  },
}));

describe('inboxes threads emails forward command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockForward.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('forwards an email to multiple recipients with a note', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'a@example.com',
        '--to',
        'b@example.com',
        '--text',
        'FYI',
      ],
      { from: 'user' },
    );

    expect(mockForward).toHaveBeenCalledTimes(1);
    const args = mockForward.mock.calls[0][0] as Record<string, unknown>;
    expect(args.to).toEqual(['a@example.com', 'b@example.com']);
    expect(args.text).toBe('FYI');
  });

  it('passes repeated --cc and --bcc to the SDK', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'a@example.com',
        '--cc',
        'c@example.com',
        '--cc',
        'e@example.com',
        '--bcc',
        'd@example.com',
        '--bcc',
        'f@example.com',
      ],
      { from: 'user' },
    );

    const args = mockForward.mock.calls[0][0] as Record<string, unknown>;
    expect(args.cc).toEqual(['c@example.com', 'e@example.com']);
    expect(args.bcc).toEqual(['d@example.com', 'f@example.com']);
  });

  it('omits cc and bcc when the flags are absent', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'a@example.com',
      ],
      { from: 'user' },
    );

    const args = mockForward.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('cc');
    expect(args).not.toHaveProperty('bcc');
  });

  it('passes idempotencyKey as second arg to threads.emails.forward', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'a@example.com',
        '--idempotency-key',
        'my-key-123',
      ],
      { from: 'user' },
    );

    expect(mockForward).toHaveBeenCalledTimes(1);
    const opts = mockForward.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.idempotencyKey).toBe('my-key-123');
  });

  it('errors with missing_to when no recipient is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_to');
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockForward.mockResolvedValueOnce(
      mockSdkError('Email not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
          '--to',
          'a@example.com',
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
      await forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
          '--to',
          'teammate@example.com',
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

    const args = mockForward.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const attachments = args.attachments as Array<Record<string, unknown>>;
    expect(attachments).toHaveLength(3);
    expect(attachments[0].filename).toBe('notes.txt');
    expect(Buffer.isBuffer(attachments[0].content)).toBe(true);
    expect(attachments[1]).toEqual({
      path: 'https://example.com/report.pdf',
      filename: 'report.pdf',
    });
    expect(attachments[2]).toEqual({ filename: 'extra.txt', content: 'aGk=' });
  });

  it('errors with file_read_error when an --attachment file is missing', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    mockForward.mockClear();

    await expectExit1(() =>
      forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
          '--to',
          'teammate@example.com',
          '--attachment',
          '/tmp/nonexistent-resend-inbox-attachment.txt',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('passes --headers to the SDK', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'teammate@example.com',
        '--headers',
        'X-Ticket-Id=4821',
      ],
      { from: 'user' },
    );

    const args = mockForward.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(args.headers).toEqual({ 'X-Ticket-Id': '4821' });
  });

  it('errors with invalid_header for a header without =', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    mockForward.mockClear();

    await expectExit1(() =>
      forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
          '--to',
          'teammate@example.com',
          '--headers',
          'X-Ticket-Id',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_header');
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('sends an explicit empty --subject, --text, and --html', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'teammate@example.com',
        '--subject',
        '',
        '--text',
        '',
        '--html',
        '',
      ],
      { from: 'user' },
    );

    const args = mockForward.mock.calls[0][0] as Record<string, unknown>;
    expect(args.subject).toBe('');
    expect(args.text).toBe('');
    expect(args.html).toBe('');
  });
});
