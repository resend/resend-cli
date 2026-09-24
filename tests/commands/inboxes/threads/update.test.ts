import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { updateInboxThreadCommand } from '../../../../src/commands/inboxes/threads/update';
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

const mockUpdate = vi.fn(async () => ({
  data: {
    object: 'inbox_thread' as const,
    id: THREAD_ID,
    subject: 'Billing question',
    folder: 'archive' as const,
    labels: [],
    read: true,
  },
  error: null,
}));

vi.mock('resend', async (importOriginal) => {
  const original = await importOriginal<typeof import('resend')>();
  return {
    MOVE_THREAD_FOLDERS: original.MOVE_THREAD_FOLDERS,
    Resend: class MockResend {
      constructor(public key: string) {}
      inboxes = { threads: { update: mockUpdate } };
    },
  };
});

describe('inboxes threads update command', () => {
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

  it('marks a thread read and moves it', async () => {
    setupOutputSpies();

    await updateInboxThreadCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--read',
        '--folder',
        'archive',
      ],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.threadId).toBe(THREAD_ID);
    expect(args.read).toBe(true);
    expect(args.folder).toBe('archive');
  });

  it('maps --unread to read: false and passes --label_id', async () => {
    setupOutputSpies();

    await updateInboxThreadCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--unread',
        '--label_id',
        'label-1',
      ],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.read).toBe(false);
    expect(args.labelId).toBe('label-1');
  });

  it('errors with invalid_options when --read and --unread are combined', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxThreadCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--read',
          '--unread',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with no_changes when no update option is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxThreadCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID],
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
      mockSdkError('Thread not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxThreadCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--thread_id', THREAD_ID, '--read'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
