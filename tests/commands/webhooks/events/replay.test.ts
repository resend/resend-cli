import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { replayWebhookEventCommand } from '../../../../src/commands/webhooks/events/replay';
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

const mockReplay = vi.fn(async () => ({
  data: {
    object: 'webhook_event' as const,
    id: EVENT_ID,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { events: { replay: mockReplay } };
  },
}));

describe('webhooks events replay command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockReplay.mockClear();
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

    await replayWebhookEventCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
      from: 'user',
    });

    expect(mockReplay).toHaveBeenCalledTimes(1);
    const opts = mockReplay.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.webhookId).toBe(WEBHOOK_ID);
    expect(opts.eventId).toBe(EVENT_ID);
  });

  it('outputs the replayed event as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await replayWebhookEventCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('webhook_event');
    expect(parsed.id).toBe(EVENT_ID);
  });

  it('errors with replay_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockReplay.mockResolvedValueOnce(
      mockSdkError('Webhook is disabled', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      replayWebhookEventCommand.parseAsync([WEBHOOK_ID, EVENT_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('replay_error');
  });
});
