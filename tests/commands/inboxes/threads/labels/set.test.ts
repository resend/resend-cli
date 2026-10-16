import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { setInboxThreadLabelsCommand } from '../../../../../src/commands/inboxes/threads/labels/set';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const INBOX_ADDRESS = 'support@example.com';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const LABEL_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_LABEL_ID = '66666666-7777-8888-9999-000000000000';

const LABEL_LIST = {
  object: 'list' as const,
  data: [
    { id: LABEL_ID, name: 'Billing', color: '#E93D82' },
    { id: OTHER_LABEL_ID, name: 'Urgent', color: '#12A594' },
  ],
};

const mockSet = vi.fn(async () => ({ data: LABEL_LIST, error: null }));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { labels: { set: mockSet } } };
  },
}));

describe('inboxes threads labels set command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSet.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('sends the label IDs and outputs the labels of the thread', async () => {
    const spies = setupOutputSpies();

    await setInboxThreadLabelsCommand.parseAsync(
      [INBOX_ID, THREAD_ID, '--labels', LABEL_ID, OTHER_LABEL_ID],
      { from: 'user' },
    );

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet.mock.calls[0]).toStrictEqual([
      {
        inboxId: INBOX_ID,
        threadId: THREAD_ID,
        labels: [LABEL_ID, OTHER_LABEL_ID],
      },
    ]);
    expect(JSON.parse(spies.logSpy.mock.calls[0][0] as string)).toStrictEqual(
      LABEL_LIST,
    );
  });

  it('splits comma-separated label IDs', async () => {
    setupOutputSpies();

    await setInboxThreadLabelsCommand.parseAsync(
      [INBOX_ID, THREAD_ID, '--labels', `${LABEL_ID},${OTHER_LABEL_ID}`],
      { from: 'user' },
    );

    expect(mockSet.mock.calls[0]).toStrictEqual([
      {
        inboxId: INBOX_ID,
        threadId: THREAD_ID,
        labels: [LABEL_ID, OTHER_LABEL_ID],
      },
    ]);
  });

  it('passes an inbox email address as emailAddress', async () => {
    setupOutputSpies();

    await setInboxThreadLabelsCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ADDRESS,
        '--thread-id',
        THREAD_ID,
        '--labels',
        LABEL_ID,
      ],
      { from: 'user' },
    );

    expect(mockSet.mock.calls[0]).toStrictEqual([
      { emailAddress: INBOX_ADDRESS, threadId: THREAD_ID, labels: [LABEL_ID] },
    ]);
  });

  it('accepts the snake_case ID flags', async () => {
    setupOutputSpies();

    await setInboxThreadLabelsCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID, '--labels', LABEL_ID],
      { from: 'user' },
    );

    expect(mockSet.mock.calls[0]).toStrictEqual([
      { inboxId: INBOX_ID, threadId: THREAD_ID, labels: [LABEL_ID] },
    ]);
  });

  it('errors with missing_labels without --labels', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      setInboxThreadLabelsCommand.parseAsync([INBOX_ID, THREAD_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_labels');
    expect(output).toContain('--labels \\"\\"');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('errors with missing_id without a thread ID in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      setInboxThreadLabelsCommand.parseAsync([INBOX_ID, '--labels', LABEL_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('sends an empty list for --labels ""', async () => {
    setupOutputSpies();
    mockSet.mockResolvedValueOnce({
      data: { object: 'list' as const, data: [] },
      error: null,
    });

    await setInboxThreadLabelsCommand.parseAsync(
      [INBOX_ID, THREAD_ID, '--labels', ''],
      {
        from: 'user',
      },
    );

    expect(mockSet.mock.calls[0]).toStrictEqual([
      { inboxId: INBOX_ID, threadId: THREAD_ID, labels: [] },
    ]);
  });

  it('errors with update_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockSet.mockResolvedValueOnce(
      mockSdkError('Thread not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      setInboxThreadLabelsCommand.parseAsync(
        [INBOX_ID, THREAD_ID, '--labels', LABEL_ID],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
    expect(output).toContain('Thread not found.');
  });

  it('errors with invalid_options when an ID is passed as an argument and a flag', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      setInboxThreadLabelsCommand.parseAsync(
        [
          ...[INBOX_ID, THREAD_ID, '--labels', LABEL_ID],
          '--inbox-id',
          INBOX_ID,
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockSet).not.toHaveBeenCalled();
  });
});
