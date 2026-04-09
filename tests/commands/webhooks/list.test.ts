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

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'wh_abc123',
        endpoint: 'https://app.example.com/hooks/resend',
        events: ['email.sent', 'email.bounced'] as string[],
        status: 'enabled' as const,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { list: mockList };
  },
}));

describe('webhooks list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
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

  test('calls SDK list method with default pagination', async () => {
    spies = setupOutputSpies();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await listWebhooksCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(10);
  });

  test('passes --limit to pagination options', async () => {
    spies = setupOutputSpies();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await listWebhooksCommand.parseAsync(['--limit', '5'], { from: 'user' });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(5);
  });

  test('passes --after cursor to pagination options', async () => {
    spies = setupOutputSpies();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await listWebhooksCommand.parseAsync(['--after', 'wh_cursor123'], {
      from: 'user',
    });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.after).toBe('wh_cursor123');
  });

  test('outputs JSON list with webhook data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await listWebhooksCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].id).toBe('wh_abc123');
    expect(parsed.data[0].endpoint).toBe(
      'https://app.example.com/hooks/resend',
    );
    expect(parsed.has_more).toBe(false);
  });

  test('errors with invalid_limit for out-of-range limit', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await expectExit1(() =>
      listWebhooksCommand.parseAsync(['--limit', '200'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await expectExit1(() =>
      listWebhooksCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Server error', 'server_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listWebhooksCommand } = await import(
      '../../../src/commands/webhooks/list'
    );
    await expectExit1(() =>
      listWebhooksCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
