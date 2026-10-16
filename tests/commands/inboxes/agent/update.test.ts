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
    INBOX_AGENT_TONES: original.INBOX_AGENT_TONES,
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

  it('updates instructions, tone and actions', async () => {
    const spies = setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      [
        '--inbox-id',
        INBOX_ID,
        '--instructions',
        'Answer refund questions yourself.',
        '--tone',
        'expanded_professional',
        '--actions',
        'draft_reply,add_labels',
        'archive',
        'move_to_trash',
      ],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      instructions: 'Answer refund questions yourself.',
      tone: 'expanded_professional',
      actions: ['draft_reply', 'add_labels', 'archive', 'move_to_trash'],
    });
    expect(JSON.parse(spies.logSpy.mock.calls[0][0] as string)).toStrictEqual({
      object: 'inbox_agent',
      id: AGENT_ID,
    });
  });

  it('removes duplicate actions', async () => {
    setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      [INBOX_ID, '--actions', 'archive,draft_reply', 'archive'],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      actions: ['archive', 'draft_reply'],
    });
  });

  it('accepts the inbox ID as an argument', async () => {
    setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      [INBOX_ID, '--tone', 'concise_casual'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      tone: 'concise_casual',
    });
  });

  it('accepts the snake_case --inbox_id flag', async () => {
    setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--actions', 'draft_reply,add_labels'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      actions: ['draft_reply', 'add_labels'],
    });
  });

  it('sends null for an empty --tone and an empty list for --actions ""', async () => {
    setupOutputSpies();

    await updateInboxAgentCommand.parseAsync(
      ['--inbox-id', INBOX_ID, '--tone', '', '--actions', ''],
      { from: 'user' },
    );

    expect(mockUpdate.mock.calls[0][0]).toStrictEqual({
      inboxId: INBOX_ID,
      tone: null,
      actions: [],
    });
  });

  it('errors with invalid_tone for a tone that is not a preset', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--tone', 'friendly and concise'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_tone');
    expect(output).toContain('concise_professional');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with no_changes when no option is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(['--inbox-id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with invalid_actions for an unknown action', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--actions', 'reply'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_actions');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Inbox not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxAgentCommand.parseAsync(
        ['--inbox-id', INBOX_ID, '--tone', 'concise_casual'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
