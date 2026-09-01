import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listWebhookEventAttemptsCommand } from '../../../../src/commands/webhooks/events/attempts';
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

const mockListAttempts = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'atmpt_2ZbUCwvGmIT4mLIN6d3Yz0Ainbd',
        http_status_code: 500,
        response: 'Internal Server Error',
        sent_at: '2026-08-22T15:28:05.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { events: { attempts: { list: mockListAttempts } } };
  },
}));

describe('webhooks events attempts command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockListAttempts.mockClear();
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

    await listWebhookEventAttemptsCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
      from: 'user',
    });

    expect(mockListAttempts).toHaveBeenCalledTimes(1);
    const opts = mockListAttempts.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.webhookId).toBe(WEBHOOK_ID);
    expect(opts.eventId).toBe(EVENT_ID);
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    await listWebhookEventAttemptsCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.data[0].http_status_code).toBe(500);
  });

  it('passes --limit and --after to the SDK', async () => {
    spies = setupOutputSpies();

    await listWebhookEventAttemptsCommand.parseAsync(
      [WEBHOOK_ID, EVENT_ID, '--limit', '5', '--after', 'atmpt_abc'],
      { from: 'user' },
    );

    const opts = mockListAttempts.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.limit).toBe(5);
    expect(opts.after).toBe('atmpt_abc');
  });

  it('errors with list_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockListAttempts.mockResolvedValueOnce(
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
      listWebhookEventAttemptsCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
