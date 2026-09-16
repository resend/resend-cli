import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listInboxesCommand } from '../../../src/commands/inboxes/list';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: INBOX_ID,
        name: 'Support',
        email_address: 'support@acme.dev',
        friendly_name: null,
        unread: 2,
        last_received: '2026-09-15T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { list: mockList };
  },
}));

describe('inboxes list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('lists inboxes with default limit', async () => {
    spies = setupOutputSpies();

    await listInboxesCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(10);
  });

  it('passes --after cursor to the SDK', async () => {
    spies = setupOutputSpies();

    await listInboxesCommand.parseAsync(
      ['--limit', '25', '--after', INBOX_ID],
      { from: 'user' },
    );

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(25);
    expect(args.after).toBe(INBOX_ID);
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    await listInboxesCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].email_address).toBe('support@acme.dev');
  });

  it('errors with invalid_limit for out-of-range --limit', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxesCommand.parseAsync(['--limit', '500'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('errors with invalid_pagination when --after and --before are combined', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxesCommand.parseAsync(
        ['--after', INBOX_ID, '--before', INBOX_ID],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_pagination');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Internal server error', 'application_error') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxesCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
