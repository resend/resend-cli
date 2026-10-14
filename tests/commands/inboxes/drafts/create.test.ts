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
  data: { object: 'inbox_draft' as const, id: DRAFT_ID },
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
        '--inbox_id',
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
        '--inbox_id',
        INBOX_ID,
        '--text',
        'Reply body',
        '--thread_id',
        THREAD_ID,
        '--reply_to_email_id',
        EMAIL_ID,
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.threadId).toBe(THREAD_ID);
    expect(args.replyToEmailId).toBe(EMAIL_ID);
  });

  it('passes idempotencyKey as second arg to drafts.create', async () => {
    setupOutputSpies();

    await createInboxDraftCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--subject',
        'Hello',
        '--idempotency-key',
        'my-key-123',
      ],
      { from: 'user' },
    );

    const opts = mockCreate.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(opts?.idempotencyKey).toBe('my-key-123');
  });

  it('errors with invalid_options when --thread_id lacks --reply_to_email_id', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--text', 'x', '--thread_id', THREAD_ID],
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
      createInboxDraftCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_content');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with missing_content when --attachments-file holds no attachments', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    const dir = mkdtempSync(join(tmpdir(), 'resend-draft-attachments-'));
    const file = join(dir, 'attachments.json');
    writeFileSync(file, '[]');
    mockCreate.mockClear();

    try {
      await expectExit1(() =>
        createInboxDraftCommand.parseAsync(
          ['--inbox_id', INBOX_ID, '--attachments-file', file],
          { from: 'user' },
        ),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

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
        ['--inbox_id', INBOX_ID, '--text', 'x'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
  it('reads --attachment files into attachments and counts them as content', async () => {
    setupOutputSpies();
    const dir = mkdtempSync(join(tmpdir(), 'resend-draft-attachments-'));
    const file = join(dir, 'notes.txt');
    writeFileSync(file, 'hello');

    try {
      await createInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--attachment', `${file};type=text/plain`],
        { from: 'user' },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const args = mockCreate.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const attachments = args.attachments as Array<Record<string, unknown>>;
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('notes.txt');
    expect(attachments[0].contentType).toBe('text/plain');
    expect(Buffer.isBuffer(attachments[0].content)).toBe(true);
  });

  it.each([
    ['a URL', 'https://example.com/report.pdf;type=application/pdf'],
    ['no ;type=', './notes.txt'],
  ])('errors with invalid_attachment for %s', async (_case, spec) => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    const dir = mkdtempSync(join(tmpdir(), 'resend-draft-attachments-'));
    writeFileSync(join(dir, 'notes.txt'), 'hello');
    const cwd = process.cwd();
    process.chdir(dir);
    mockCreate.mockClear();

    try {
      await expectExit1(() =>
        createInboxDraftCommand.parseAsync(
          ['--inbox_id', INBOX_ID, '--attachment', spec],
          { from: 'user' },
        ),
      );
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_attachment');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with invalid_options when --thread_id is empty and --reply_to_email_id is absent', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--text', 'x', '--thread_id', ''],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('sends explicit empty thread flags for the API to validate', async () => {
    setupOutputSpies();

    await createInboxDraftCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--text',
        'x',
        '--thread_id',
        '',
        '--reply_to_email_id',
        '',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.threadId).toBe('');
    expect(args.replyToEmailId).toBe('');
  });
});
