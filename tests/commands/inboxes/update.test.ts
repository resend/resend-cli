import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { updateInboxCommand } from '../../../src/commands/inboxes/update';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockUpdate = vi.fn(async () => ({
  data: { object: 'inbox' as const, id: INBOX_ID },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { update: mockUpdate };
  },
}));

describe('inboxes update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
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
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('updates inbox name', async () => {
    spies = setupOutputSpies();

    await updateInboxCommand.parseAsync([INBOX_ID, '--name', 'Support'], {
      from: 'user',
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe(INBOX_ID);
    expect(mockUpdate.mock.calls[0][1]).toEqual({ name: 'Support' });
  });

  it('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    await updateInboxCommand.parseAsync([INBOX_ID, '--name', 'Support'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe(INBOX_ID);
  });

  it('errors with no_changes when --name is absent', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxCommand.parseAsync([INBOX_ID], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Inbox not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxCommand.parseAsync([INBOX_ID, '--name', 'Support'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
