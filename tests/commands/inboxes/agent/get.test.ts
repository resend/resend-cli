import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { getInboxAgentCommand } from '../../../../src/commands/inboxes/agent/get';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockGet = vi.fn(async () => ({
  data: {
    object: 'inbox_agent' as const,
    instructions: 'Answer refund questions yourself.',
    tone: 'concise_casual' as const,
    actions: ['draft_reply' as const, 'archive' as const],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { agent: { get: mockGet } };
  },
}));

describe('inboxes agent get command', () => {
  const restoreEnv = captureTestEnv();
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
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('fetches the agent settings and outputs JSON when non-interactive', async () => {
    const spies = setupOutputSpies();

    await getInboxAgentCommand.parseAsync(['--inbox-id', INBOX_ID], {
      from: 'user',
    });

    expect(mockGet.mock.calls[0][0]).toStrictEqual({ inboxId: INBOX_ID });
    const parsed = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(parsed).toStrictEqual({
      object: 'inbox_agent',
      instructions: 'Answer refund questions yourself.',
      tone: 'concise_casual',
      actions: ['draft_reply', 'archive'],
    });
  });

  it('prints the actions in interactive mode', async () => {
    for (const stream of [process.stdin, process.stdout]) {
      Object.defineProperty(stream, 'isTTY', { value: true, writable: true });
    }
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    await getInboxAgentCommand.parseAsync([INBOX_ID], { from: 'user' });

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    expect(output).toBe(
      [
        'Instructions: Answer refund questions yourself.',
        'Tone: concise_casual',
        'Actions: draft_reply, archive',
      ].join('\n'),
    );
  });

  it('accepts the inbox ID as an argument', async () => {
    setupOutputSpies();

    await getInboxAgentCommand.parseAsync([INBOX_ID], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toStrictEqual({ inboxId: INBOX_ID });
  });

  it('accepts the snake_case --inbox_id flag', async () => {
    setupOutputSpies();

    await getInboxAgentCommand.parseAsync(['--inbox_id', INBOX_ID], {
      from: 'user',
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toStrictEqual({ inboxId: INBOX_ID });
  });

  it('errors with missing_id when no --inbox-id in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      getInboxAgentCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Inbox not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      getInboxAgentCommand.parseAsync(['--inbox-id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
