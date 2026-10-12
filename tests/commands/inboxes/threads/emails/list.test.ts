import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listInboxThreadEmailsCommand } from '../../../../../src/commands/inboxes/threads/emails/list';
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

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: EMAIL_ID,
        direction: 'inbound' as const,
        from: 'Customer <customer@example.com>',
        to: ['support@acme.dev'],
        cc: [],
        bcc: [],
        reply_to: [],
        subject: 'Billing question',
        message_id: null,
        html: null,
        text: 'Was I charged twice?',
        attachments: [],
        read: false,
        received_at: '2026-09-15T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { emails: { list: mockList } } };
  },
}));

describe('inboxes threads emails list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('lists the emails in a thread with the default limit', async () => {
    spies = setupOutputSpies();

    await listInboxThreadEmailsCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID],
      { from: 'user' },
    );

    expect(mockList).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      threadId: THREAD_ID,
      limit: 10,
    });
  });

  it('passes pagination options', async () => {
    spies = setupOutputSpies();

    await listInboxThreadEmailsCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--limit',
        '25',
        '--after',
        EMAIL_ID,
      ],
      { from: 'user' },
    );

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(25);
    expect(args.after).toBe(EMAIL_ID);
  });

  it('passes --before to the SDK', async () => {
    spies = setupOutputSpies();

    await listInboxThreadEmailsCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID, '--before', EMAIL_ID],
      { from: 'user' },
    );

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.before).toBe(EMAIL_ID);
    expect(args).not.toHaveProperty('after');
  });

  it('outputs JSON list with bodies when non-interactive', async () => {
    spies = setupOutputSpies();

    await listInboxThreadEmailsCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].id).toBe(EMAIL_ID);
    expect(parsed.data[0].text).toBe('Was I charged twice?');
  });

  it('errors with invalid_pagination when --after and --before are both set', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxThreadEmailsCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--after',
          EMAIL_ID,
          '--before',
          EMAIL_ID,
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_pagination');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('errors with missing_id when inbox ID absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxThreadEmailsCommand.parseAsync(['--thread_id', THREAD_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('errors with missing_id when thread ID absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxThreadEmailsCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Thread not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxThreadEmailsCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
