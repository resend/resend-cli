import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listInboxDraftsCommand } from '../../../../src/commands/inboxes/drafts/list';
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

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    next_cursor: null,
    data: [
      {
        id: DRAFT_ID,
        type: 'standalone' as const,
        to: ['user@example.com'],
        cc: [],
        bcc: [],
        subject: 'Hello',
        snippet: 'Draft body',
        thread_id: null,
        reply_to_email_id: null,
        updated_at: '2026-09-15T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { drafts: { list: mockList } };
  },
}));

describe('inboxes drafts list command', () => {
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

  it('lists drafts and passes --cursor', async () => {
    spies = setupOutputSpies();

    await listInboxDraftsCommand.parseAsync([INBOX_ID, '--cursor', 'abc123'], {
      from: 'user',
    });

    expect(mockList).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      cursor: 'abc123',
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.data[0].subject).toBe('Hello');
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Inbox not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxDraftsCommand.parseAsync([INBOX_ID], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
