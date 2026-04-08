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

const mockUpdate = vi.fn(async () => ({
  data: { object: 'webhook' as const, id: 'wh_abc123' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { update: mockUpdate };
  },
}));

describe('webhooks update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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

  test('updates endpoint with --endpoint flag', async () => {
    spies = setupOutputSpies();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await updateWebhookCommand.parseAsync(
      ['wh_abc123', '--endpoint', 'https://new-app.example.com/hooks'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe('wh_abc123');
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.endpoint).toBe('https://new-app.example.com/hooks');
  });

  test('updates events with --events flag', async () => {
    spies = setupOutputSpies();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await updateWebhookCommand.parseAsync(
      ['wh_abc123', '--events', 'email.sent', 'email.bounced'],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.events).toEqual(['email.sent', 'email.bounced']);
  });

  test('expands "all" shorthand in --events to 17 events', async () => {
    spies = setupOutputSpies();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await updateWebhookCommand.parseAsync(['wh_abc123', '--events', 'all'], {
      from: 'user',
    });

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.events).toHaveLength(17);
  });

  test('updates status with --status flag', async () => {
    spies = setupOutputSpies();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await updateWebhookCommand.parseAsync(
      ['wh_abc123', '--status', 'disabled'],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.status).toBe('disabled');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await updateWebhookCommand.parseAsync(
      ['wh_abc123', '--status', 'enabled'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('webhook');
    expect(parsed.id).toBe('wh_abc123');
  });

  test('errors with no_changes when no flags are provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await expectExit1(() =>
      updateWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
  });

  test('does not call SDK when no_changes error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await expectExit1(() =>
      updateWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await expectExit1(() =>
      updateWebhookCommand.parseAsync(['wh_abc123', '--status', 'enabled'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Webhook not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateWebhookCommand } = await import(
      '../../../src/commands/webhooks/update'
    );
    await expectExit1(() =>
      updateWebhookCommand.parseAsync(
        ['wh_nonexistent', '--status', 'disabled'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
