import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { getInboxCommand } from '../../../src/commands/inboxes/get';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockGet = vi.fn(async () => ({
  data: {
    object: 'inbox' as const,
    id: INBOX_ID,
    name: 'Support',
    email_address: 'support@acme.dev',
    forwarding_address: null,
    friendly_name: null,
    unread: 2,
    drafts: 0,
    last_received: '2026-09-15T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { get: mockGet };
  },
}));

describe('inboxes get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
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
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('fetches inbox by ID and outputs JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await getInboxCommand.parseAsync([INBOX_ID], { from: 'user' });

    expect(mockGet).toHaveBeenCalledWith(INBOX_ID);
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe(INBOX_ID);
    expect(parsed.email_address).toBe('support@acme.dev');
  });

  it('errors with missing_id when no argument in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() => getInboxCommand.parseAsync([], { from: 'user' }));

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
      getInboxCommand.parseAsync([INBOX_ID], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
