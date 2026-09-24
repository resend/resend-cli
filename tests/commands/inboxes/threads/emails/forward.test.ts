import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { forwardInboxThreadEmailCommand } from '../../../../../src/commands/inboxes/threads/emails/forward';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';
const FORWARD_ID = '9f3b5a1e-2c4d-4e6f-8a0b-1c2d3e4f5a6b';

const mockForward = vi.fn(async () => ({
  data: {
    id: FORWARD_ID,
    email_id: FORWARD_ID,
    direction: 'outbound' as const,
    from: 'support@acme.dev',
    to: ['teammate@example.com'],
    cc: [],
    bcc: [],
    html: null,
    text: 'FYI',
    attachments: [],
    read: true,
    received_at: '2026-09-15T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { threads: { emails: { forward: mockForward } } };
  },
}));

describe('inboxes threads emails forward command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockForward.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('forwards an email to multiple recipients with a note', async () => {
    setupOutputSpies();

    await forwardInboxThreadEmailCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--thread_id',
        THREAD_ID,
        '--email_id',
        EMAIL_ID,
        '--to',
        'a@example.com',
        '--to',
        'b@example.com',
        '--text',
        'FYI',
      ],
      { from: 'user' },
    );

    expect(mockForward).toHaveBeenCalledTimes(1);
    const args = mockForward.mock.calls[0][0] as Record<string, unknown>;
    expect(args.to).toEqual(['a@example.com', 'b@example.com']);
    expect(args.text).toBe('FYI');
  });

  it('errors with missing_to when no recipient is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_to');
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockForward.mockResolvedValueOnce(
      mockSdkError('Email not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      forwardInboxThreadEmailCommand.parseAsync(
        [
          '--inbox_id',
          INBOX_ID,
          '--thread_id',
          THREAD_ID,
          '--email_id',
          EMAIL_ID,
          '--to',
          'a@example.com',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
