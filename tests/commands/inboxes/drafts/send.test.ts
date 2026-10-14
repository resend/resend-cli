import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { sendInboxDraftCommand } from '../../../../src/commands/inboxes/drafts/send';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const DRAFT_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';

const mockSend = vi.fn(async () => ({
  data: { id: EMAIL_ID },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { drafts: { send: mockSend } };
  },
}));

describe('inboxes drafts send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('sends a draft and outputs the sent email id as JSON', async () => {
    spies = setupOutputSpies();

    await sendInboxDraftCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
      {
        from: 'user',
      },
    );

    expect(mockSend).toHaveBeenCalledWith(
      { inboxId: INBOX_ID, draftId: DRAFT_ID },
      undefined,
    );
    const output = spies.logSpy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual({ id: EMAIL_ID });
  });

  it('prints the sent email id in interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    try {
      await sendInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
        { from: 'user' },
      );
      expect(logSpy).toHaveBeenCalledWith(`Draft sent: ${EMAIL_ID}`);
    } finally {
      logSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });

  it('passes idempotencyKey as second arg to drafts.send', async () => {
    spies = setupOutputSpies();

    await sendInboxDraftCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--draft_id',
        DRAFT_ID,
        '--idempotency-key',
        'my-key-123',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const opts = mockSend.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.idempotencyKey).toBe('my-key-123');
  });

  it('passes an empty idempotencyKey through for the API to validate', async () => {
    spies = setupOutputSpies();

    await sendInboxDraftCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID, '--idempotency-key', ''],
      { from: 'user' },
    );

    const opts = mockSend.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.idempotencyKey).toBe('');
  });

  it('errors with send_error when SDK returns an error', async () => {
    setNonInteractive();
    mockSend.mockResolvedValueOnce(
      mockSdkError('Draft has no recipients.', 'validation_error') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      sendInboxDraftCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--draft_id', DRAFT_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('send_error');
  });

  it('passes --headers in the send payload', async () => {
    spies = setupOutputSpies();

    await sendInboxDraftCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--draft_id',
        DRAFT_ID,
        '--headers',
        'X-Ticket-Id=4821',
        'X-Note=a=b',
      ],
      { from: 'user' },
    );

    const args = mockSend.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(args).toEqual({
      inboxId: INBOX_ID,
      draftId: DRAFT_ID,
      headers: { 'X-Ticket-Id': '4821', 'X-Note': 'a=b' },
    });
  });
});
