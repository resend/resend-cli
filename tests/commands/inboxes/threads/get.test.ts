import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { getInboxThreadCommand } from '../../../../src/commands/inboxes/threads/get';
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

const mockGet = vi.fn(async () => ({
  data: {
    object: 'inbox_thread' as const,
    id: THREAD_ID,
    subject: 'Billing question',
    folder: 'inbox' as const,
    labels: [],
    read: false,
    messages: {
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
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { get: mockGet } };
  },
}));

describe('inboxes threads get command', () => {
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

  it('fetches a thread with messages and outputs JSON', async () => {
    spies = setupOutputSpies();

    await getInboxThreadCommand.parseAsync([INBOX_ID, THREAD_ID], {
      from: 'user',
    });

    expect(mockGet).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      threadId: THREAD_ID,
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe(THREAD_ID);
    expect(parsed.messages.data[0].text).toBe('Was I charged twice?');
  });

  it('errors with missing_id when thread ID absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      getInboxThreadCommand.parseAsync([INBOX_ID], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Thread not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      getInboxThreadCommand.parseAsync([INBOX_ID, THREAD_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
