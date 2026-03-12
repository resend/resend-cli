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

const mockRemove = vi.fn(async () => ({
  data: { object: 'webhook' as const, id: 'wh_abc123', deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { remove: mockRemove };
  },
}));

describe('webhooks delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
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

  test('deletes webhook with --yes flag', async () => {
    spies = setupOutputSpies();

    const { deleteWebhookCommand } = await import(
      '../../../src/commands/webhooks/delete'
    );
    await deleteWebhookCommand.parseAsync(['wh_abc123', '--yes'], {
      from: 'user',
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe('wh_abc123');
  });

  test('outputs synthesized JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { deleteWebhookCommand } = await import(
      '../../../src/commands/webhooks/delete'
    );
    await deleteWebhookCommand.parseAsync(['wh_abc123', '--yes'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('webhook');
    expect(parsed.id).toBe('wh_abc123');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteWebhookCommand } = await import(
      '../../../src/commands/webhooks/delete'
    );
    await expectExit1(() =>
      deleteWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('does not call SDK when confirmation_required error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteWebhookCommand } = await import(
      '../../../src/commands/webhooks/delete'
    );
    await expectExit1(() =>
      deleteWebhookCommand.parseAsync(['wh_abc123'], { from: 'user' }),
    );

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteWebhookCommand } = await import(
      '../../../src/commands/webhooks/delete'
    );
    await expectExit1(() =>
      deleteWebhookCommand.parseAsync(['wh_abc123', '--yes'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('Webhook not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteWebhookCommand } = await import(
      '../../../src/commands/webhooks/delete'
    );
    await expectExit1(() =>
      deleteWebhookCommand.parseAsync(['wh_nonexistent', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
