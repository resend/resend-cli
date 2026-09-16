import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { deleteInboxThreadCommand } from '../../../../src/commands/inboxes/threads/delete';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';

const mockRemove = vi.fn(async () => ({
  data: { object: 'inbox_thread' as const, id: THREAD_ID, deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { remove: mockRemove } };
  },
}));

describe('inboxes threads delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('deletes a thread with --yes and outputs synthesized JSON', async () => {
    spies = setupOutputSpies();

    await deleteInboxThreadCommand.parseAsync(
      ['--inbox-id', INBOX_ID, '--thread-id', THREAD_ID, '--yes'],
      {
        from: 'user',
      },
    );

    expect(mockRemove).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      threadId: THREAD_ID,
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('inbox_thread');
    expect(parsed.deleted).toBe(true);
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      deleteInboxThreadCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--thread-id', THREAD_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
