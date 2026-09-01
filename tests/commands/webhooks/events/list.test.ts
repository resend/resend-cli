import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listWebhookEventsCommand } from '../../../../src/commands/webhooks/events/list';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const WEBHOOK_ID = '4dd369bc-aa82-4ff3-97de-514ae3000ee0';

const mockListEvents = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
        type: 'email.sent',
        created_at: '2026-08-22T15:27:42.000Z',
        status: 'success',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { events: { list: mockListEvents } };
  },
}));

describe('webhooks events list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockListEvents.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  it('passes the webhook id through as webhookId, not a positional arg', async () => {
    spies = setupOutputSpies();

    await listWebhookEventsCommand.parseAsync([WEBHOOK_ID], { from: 'user' });

    expect(mockListEvents).toHaveBeenCalledTimes(1);
    const opts = mockListEvents.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.webhookId).toBe(WEBHOOK_ID);
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    await listWebhookEventsCommand.parseAsync([WEBHOOK_ID], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].type).toBe('email.sent');
  });

  it('passes --limit and --after to the SDK', async () => {
    spies = setupOutputSpies();

    await listWebhookEventsCommand.parseAsync(
      [
        WEBHOOK_ID,
        '--limit',
        '50',
        '--after',
        'msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
      ],
      { from: 'user' },
    );

    const opts = mockListEvents.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.limit).toBe(50);
    expect(opts.after).toBe('msg_1srOrx2ZWZBpBUvZwXKQmoEYga2');
  });

  it('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listWebhookEventsCommand.parseAsync([WEBHOOK_ID, '--limit', '999'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  it('errors with list_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockListEvents.mockResolvedValueOnce(
      mockSdkError('Webhook endpoint not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listWebhookEventsCommand.parseAsync([WEBHOOK_ID], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
