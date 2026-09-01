import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { getWebhookEventCommand } from '../../../../src/commands/webhooks/events/get';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const WEBHOOK_ID = '4dd369bc-aa82-4ff3-97de-514ae3000ee0';
const EVENT_ID = 'msg_1srOrx2ZWZBpBUvZwXKQmoEYga2';

const mockGetEvent = vi.fn(async () => ({
  data: {
    object: 'webhook_event' as const,
    id: EVENT_ID,
    type: 'email.sent',
    created_at: '2026-08-22T15:28:00.000Z',
    status: 'attempting',
    next_attempt_at: '2026-08-22T15:33:00.000Z',
    payload: { type: 'email.sent' },
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { events: { get: mockGetEvent } };
  },
}));

describe('webhooks events get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGetEvent.mockClear();
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

  it('maps the two positional args to webhookId and eventId in that order', async () => {
    spies = setupOutputSpies();

    await getWebhookEventCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
      from: 'user',
    });

    expect(mockGetEvent).toHaveBeenCalledTimes(1);
    const opts = mockGetEvent.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.webhookId).toBe(WEBHOOK_ID);
    expect(opts.eventId).toBe(EVENT_ID);
  });

  it('outputs the event as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await getWebhookEventCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('webhook_event');
    expect(parsed.next_attempt_at).toBe('2026-08-22T15:33:00.000Z');
  });

  it('errors with fetch_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockGetEvent.mockResolvedValueOnce(
      mockSdkError(
        'The resource you are looking for is not available',
        'not_found',
      ),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      getWebhookEventCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
