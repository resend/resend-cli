import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockGet = vi.fn(async () => ({
  data: {
    object: 'webhook' as const,
    id: 'wh_abc123',
    endpoint: 'https://app.example.com/hooks/resend',
    events: ['email.sent', 'email.bounced'] as string[],
    status: 'enabled' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    signing_secret: 'whsec_test1234',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { get: mockGet };
  },
}));

describe('webhooks get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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

  test('calls SDK get with the provided id', async () => {
    spies = setupOutputSpies();

    const { getWebhookCommand } = await import(
      '../../../src/commands/webhooks/get'
    );
    await getWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('wh_abc123');
  });

  test('outputs JSON with webhook fields when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getWebhookCommand } = await import(
      '../../../src/commands/webhooks/get'
    );
    await getWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('wh_abc123');
    expect(parsed.endpoint).toBe('https://app.example.com/hooks/resend');
    expect(parsed.status).toBe('enabled');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getWebhookCommand } = await import(
      '../../../src/commands/webhooks/get'
    );
    await expectExit1(() =>
      getWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getWebhookCommand } = await import(
      '../../../src/commands/webhooks/get'
    );
    await expectExit1(() =>
      getWebhookCommand.parseAsync(['wh_nonexistent'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
