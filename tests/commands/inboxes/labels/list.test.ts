import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listInboxLabelsCommand } from '../../../../src/commands/inboxes/labels/list';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const LABEL_ID = '11111111-2222-3333-4444-555555555555';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    data: [
      {
        id: LABEL_ID,
        name: 'Billing',
        color: 'teal' as const,
        created_at: '2026-09-15T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { labels: { list: mockList } };
  },
}));

describe('inboxes labels list command', () => {
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

  it('lists labels and outputs JSON', async () => {
    spies = setupOutputSpies();

    await listInboxLabelsCommand.parseAsync(['--inbox_id', INBOX_ID], {
      from: 'user',
    });

    expect(mockList).toHaveBeenCalledWith({ inboxId: INBOX_ID });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.data[0].name).toBe('Billing');
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Inbox not found', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listInboxLabelsCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
