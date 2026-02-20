import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import {
  setNonInteractive,
  mockExitThrow,
  captureTestEnv,
  setupOutputSpies,
  expectExit1,
} from '../../helpers';

const mockCreate = mock(async () => ({
  data: { object: 'webhook' as const, id: 'wh_abc123', signing_secret: 'whsec_test1234' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { create: mockCreate };
  },
}));

describe('webhooks create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  test('creates webhook with --endpoint and explicit --events', async () => {
    spies = setupOutputSpies();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await createWebhookCommand.parseAsync(
      ['--endpoint', 'https://app.example.com/hooks', '--events', 'email.sent', 'email.bounced'],
      { from: 'user' }
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.endpoint).toBe('https://app.example.com/hooks');
    expect(args.events).toEqual(['email.sent', 'email.bounced']);
  });

  test('expands "all" shorthand to all 17 events', async () => {
    spies = setupOutputSpies();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await createWebhookCommand.parseAsync(
      ['--endpoint', 'https://app.example.com/hooks', '--events', 'all'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.events).toHaveLength(17);
    expect(args.events).toContain('email.sent');
    expect(args.events).toContain('contact.created');
    expect(args.events).toContain('domain.deleted');
  });

  test('outputs JSON with id and signing_secret when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await createWebhookCommand.parseAsync(
      ['--endpoint', 'https://app.example.com/hooks', '--events', 'email.sent'],
      { from: 'user' }
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('wh_abc123');
    expect(parsed.signing_secret).toBe('whsec_test1234');
  });

  test('errors with missing_endpoint in non-interactive mode when --endpoint absent', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await expectExit1(() =>
      createWebhookCommand.parseAsync(['--events', 'email.sent'], { from: 'user' })
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_endpoint');
  });

  test('errors with missing_events in non-interactive mode when --events absent', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await expectExit1(() =>
      createWebhookCommand.parseAsync(['--endpoint', 'https://app.example.com/hooks'], { from: 'user' })
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_events');
  });

  test('does not call SDK when missing_endpoint error is raised', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await expectExit1(() =>
      createWebhookCommand.parseAsync(['--events', 'email.sent'], { from: 'user' })
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await expectExit1(() =>
      createWebhookCommand.parseAsync(
        ['--endpoint', 'https://app.example.com/hooks', '--events', 'email.sent'],
        { from: 'user' }
      )
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce({ data: null, error: { message: 'Invalid endpoint', name: 'validation_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createWebhookCommand } = await import('../../../src/commands/webhooks/create');
    await expectExit1(() =>
      createWebhookCommand.parseAsync(
        ['--endpoint', 'https://app.example.com/hooks', '--events', 'email.sent'],
        { from: 'user' }
      )
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
