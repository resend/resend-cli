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
import { updateInboxDraftCommand } from '../../../../src/commands/inboxes/drafts/update';
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

const mockUpdate = vi.fn(async () => ({
  data: {
    object: 'inbox_draft' as const,
    id: DRAFT_ID,
    type: 'standalone' as const,
    to: ['user@example.com'],
    cc: [],
    bcc: [],
    subject: 'Updated',
    html: null,
    text: 'New body',
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
    inboxes = { drafts: { update: mockUpdate } };
  },
}));

describe('inboxes drafts update command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('updates subject and body', async () => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--draft-id',
        DRAFT_ID,
        '--subject',
        'Updated',
        '--text',
        'New body',
      ],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      subject: 'Updated',
      text: 'New body',
    });
  });

  it('accepts the IDs as arguments', async () => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync(
      [INBOX_ID, DRAFT_ID, '--subject', 'Updated'],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      subject: 'Updated',
    });
  });

  it('accepts the snake_case flags', async () => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID, '--subject', 'Updated'],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      subject: 'Updated',
    });
  });

  it.each([
    ['one --to', ['--to', 'a@x.com', 'b@x.com']],
    ['repeated --to', ['--to', 'a@x.com', '--to', 'b@x.com']],
  ])('replaces every recipient with %s', async (_case, toArgs) => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync([INBOX_ID, DRAFT_ID, ...toArgs], {
      from: 'user',
    });

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      to: ['a@x.com', 'b@x.com'],
    });
  });

  it('sends null for each clear flag', async () => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync(
      [
        INBOX_ID,
        DRAFT_ID,
        '--clear-to',
        '--clear-cc',
        '--clear-subject',
        '--clear-html',
        '--text',
        'New body',
      ],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      to: null,
      cc: null,
      subject: null,
      text: 'New body',
      html: null,
    });
  });

  it('counts a clear flag alone as a change', async () => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync(
      [INBOX_ID, DRAFT_ID, '--clear-bcc'],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      bcc: null,
    });
  });

  it('errors with invalid_options when --clear-cc is combined with --cc', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxDraftCommand.parseAsync(
        [INBOX_ID, DRAFT_ID, '--clear-cc', '--cc', 'a@x.com'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with no_changes when no option is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxDraftCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--draft-id', DRAFT_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Draft not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxDraftCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--draft-id', DRAFT_ID, '--text', 'x'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
  it('sends an empty attachments array with --clear-attachments', async () => {
    setupOutputSpies();

    await updateInboxDraftCommand.parseAsync(
      ['--inbox-id', INBOX_ID, '--draft-id', DRAFT_ID, '--clear-attachments'],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      attachments: [],
    });
  });

  it('replaces attachments from --attachments-file', async () => {
    setupOutputSpies();
    const dir = mkdtempSync(join(tmpdir(), 'resend-draft-attachments-'));
    const jsonFile = join(dir, 'attachments.json');
    writeFileSync(
      jsonFile,
      JSON.stringify([
        { filename: 'a.txt', content: 'aGk=', content_type: 'text/plain' },
      ]),
    );

    try {
      await updateInboxDraftCommand.parseAsync(
        [
          '--inbox-id',
          INBOX_ID,
          '--draft-id',
          DRAFT_ID,
          '--attachments-file',
          jsonFile,
        ],
        { from: 'user' },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      attachments: [
        { content: 'aGk=', filename: 'a.txt', contentType: 'text/plain' },
      ],
    });
  });

  it('errors with invalid_options when --clear-attachments is combined with --attachment', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    mockUpdate.mockClear();

    await expectExit1(() =>
      updateInboxDraftCommand.parseAsync(
        [
          '--inbox-id',
          INBOX_ID,
          '--draft-id',
          DRAFT_ID,
          '--clear-attachments',
          '--attachment',
          './notes.txt;type=text/plain',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
