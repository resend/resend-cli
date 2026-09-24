import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listInboxThreadsCommand } from '../../../../src/commands/inboxes/threads/list';
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

const mockList = vi.fn(async () => ({
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
      inboxes = { threads: { list: mockList } };
    },
  };
});

describe('inboxes threads list command', () => {
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

  it('lists threads for an inbox', async () => {
    spies = setupOutputSpies();

    await listInboxThreadsCommand.parseAsync(['--inbox_id', INBOX_ID], {
      from: 'user',
    });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.folder).toBeUndefined();
    expect(args.limit).toBe(10);
  });

  it('passes folder, query, from, labels, and pagination options', async () => {
    spies = setupOutputSpies();

    await listInboxThreadsCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--folder',
        'archive',
        '--query',
        'billing',
        '--from',
        'customer@example.com',
        '--label',
        'label-1',
        '--label',
        'label-2',
        '--limit',
        '25',
        '--after',
        THREAD_ID,
      ],
      { from: 'user' },
    );

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.folder).toBe('archive');
    expect(args.query).toBe('billing');
    expect(args.from).toBe('customer@example.com');
    expect(args.label).toEqual(['label-1', 'label-2']);
    expect(args.limit).toBe(25);
    expect(args.after).toBe(THREAD_ID);
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    await listInboxThreadsCommand.parseAsync(['--inbox_id', INBOX_ID], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].subject).toBe('Billing question');
  });

  it('errors with missing_id when inbox ID absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxThreadsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Inbox not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxThreadsCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
