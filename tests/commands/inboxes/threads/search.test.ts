import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { searchInboxThreadsCommand } from '../../../../src/commands/inboxes/threads/search';
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
const LABEL_ID = '11111111-2222-3333-4444-555555555555';

const mockSearch = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: THREAD_ID,
        subject: 'Billing question',
        from: 'Customer <customer@example.com>',
        to: [],
        cc: [],
        bcc: [],
        labels: [],
        message_count: 1,
        has_attachment: false,
        has_draft: false,
        read: false,
        received_at: '2026-09-15T00:00:00.000Z',
        folder: 'inbox' as const,
        matched_email_id: EMAIL_ID,
        highlights: { subject: ['**Billing** question'] },
      },
    ],
  },
  error: null,
}));

vi.mock('resend', async (importOriginal) => {
  const original = await importOriginal<typeof import('resend')>();
  return {
    INBOX_MESSAGE_FOLDERS: original.INBOX_MESSAGE_FOLDERS,
    Resend: class MockResend {
      constructor(public key: string) {}
      inboxes = { threads: { search: mockSearch } };
    },
  };
});

describe('inboxes threads search command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSearch.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('maps every flag to the SDK search options', async () => {
    spies = setupOutputSpies();

    await searchInboxThreadsCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--query',
        '"q3 renewal" -draft',
        '--from',
        'isabella@example.com',
        'carolina',
        '--to',
        'billing@example.com',
        '--cc',
        'finance@example.com',
        '--bcc',
        'audit@example.com',
        '--has_attachment',
        '--start_date',
        '2026-09-01',
        '--end_date',
        '2026-09-30',
        '--folders',
        'archive',
        '--labels',
        LABEL_ID,
        '--read',
        '--limit',
        '25',
        '--after',
        THREAD_ID,
      ],
      { from: 'user' },
    );

    expect(mockSearch).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      query: '"q3 renewal" -draft',
      from: ['isabella@example.com', 'carolina'],
      to: ['billing@example.com'],
      cc: ['finance@example.com'],
      bcc: ['audit@example.com'],
      hasAttachment: true,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      folders: ['archive'],
      labels: [LABEL_ID],
      read: true,
      limit: 25,
      after: THREAD_ID,
    });
  });

  it('sends hasAttachment false for --without_attachment and leaves unset filters out', async () => {
    spies = setupOutputSpies();

    await searchInboxThreadsCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--without_attachment'],
      { from: 'user' },
    );

    const args = mockSearch.mock.calls[0][0] as Record<string, unknown>;
    expect(args.hasAttachment).toBe(false);
    expect(args.query).toBeUndefined();
    expect(args.from).toBeUndefined();
    expect(args.folders).toBeUndefined();
    expect(args.labels).toBeUndefined();
    expect(args.read).toBeUndefined();
  });

  it('outputs the match and highlights as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await searchInboxThreadsCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--query', 'billing'],
      { from: 'user' },
    );

    const parsed = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(parsed.data[0].matched_email_id).toBe(EMAIL_ID);
    expect(parsed.data[0].highlights.subject).toEqual(['**Billing** question']);
  });

  it('errors with invalid_options when both attachment flags are passed', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      searchInboxThreadsCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--has_attachment', '--without_attachment'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockSearch.mockResolvedValueOnce(
      mockSdkError(
        'The `labels` value "x" must be a valid UUID.',
        'validation_error',
      ) as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      searchInboxThreadsCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
