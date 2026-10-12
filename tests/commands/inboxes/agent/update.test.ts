import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { updateInboxAgentCommand } from '../../../../src/commands/inboxes/agent/update';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const AGENT_ID = 'a1f84a4e-6f2b-4f0a-9c1d-8a2e5b3c7d90';

const mockUpdate = vi.fn(async () => ({
  data: { object: 'inbox_agent' as const, id: AGENT_ID },
  error: null,
}));

vi.mock('resend', async (importOriginal) => {
  const original = await importOriginal<typeof import('resend')>();
  return {
    INBOX_AGENT_ACTIONS: original.INBOX_AGENT_ACTIONS,
    Resend: class MockResend {
      constructor(public key: string) {}
      inboxes = { agent: { update: mockUpdate } };
    },
  };
});

describe('inboxes agent update command', () => {
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

  it('updates instructions and enabled actions', async () => {
    setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--instructions',
        'Answer refund questions yourself.',
        '--enabled_actions',
        'draft_reply,add_labels',
        'archive_thread',
      ],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      instructions: 'Answer refund questions yourself.',
      enabledActions: ['draft_reply', 'add_labels', 'archive_thread'],
    });
  });

  it('sends null for an empty --tone and an empty list for --enabled_actions ""', async () => {
    setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--tone', '', '--enabled_actions', ''],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      tone: null,
      enabledActions: [],
    });
  });

  it('errors with no_changes when no option is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with invalid_enabled_actions for an unknown action', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--enabled_actions', 'reply'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_enabled_actions');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError(
        'The tone must be 64 characters or less.',
        'validation_error',
      ) as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--tone', 'calm'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
