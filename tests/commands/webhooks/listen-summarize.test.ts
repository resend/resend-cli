import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTestEnv, setupOutputSpies } from '../../helpers';

const mockCreate = vi.fn(async () => ({
  data: { object: 'webhook' as const, id: 'wh_test', signing_secret: 'sec' },
  error: null,
}));
const mockRemove = vi.fn(async () => ({ data: null, error: null }));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = { create: mockCreate, remove: mockRemove };
  },
}));

const postJSON = async (
  port: number,
  body: Record<string, unknown>,
): Promise<{ status: number }> => {
  const resp = await fetch(`http://127.0.0.1:${port}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status };
};

describe('webhook listen event summary', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
    mockRemove.mockClear();
  });

  afterEach(async () => {
    restoreEnv();

    const exitStub = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never);
    process.emit('SIGTERM', 'SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
    exitStub.mockRestore();

    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  it('includes message_id and email_id in json output for email events', async () => {
    const { logSpy, stderrSpy } = setupOutputSpies();

    const { listenWebhookCommand } = await import(
      '../../../src/commands/webhooks/listen'
    );

    const listenerPort = 10_000 + Math.floor(Math.random() * 50_000);

    listenWebhookCommand
      .parseAsync(
        ['--url', 'https://tunnel.example.com', '--port', String(listenerPort)],
        { from: 'user' },
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 500));

    await postJSON(listenerPort, {
      type: 'email.delivered',
      created_at: '2026-02-22T23:41:12.126Z',
      data: {
        email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
        message_id: '<111-222-333@email.example.com>',
        from: 'Acme <onboarding@resend.dev>',
        to: ['delivered@resend.dev'],
        subject: 'Hello',
        created_at: '2026-02-22T23:41:11.894719+00:00',
      },
    });

    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.resource_id).toBe('56761188-7520-42d8-8898-ff6fc54ce618');
    expect(entry.payload.data.message_id).toBe(
      '<111-222-333@email.example.com>',
    );

    logSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('shows message_id in interactive stderr output for email events', async () => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    process.env.TERM = 'xterm-256color';
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    const { listenWebhookCommand } = await import(
      '../../../src/commands/webhooks/listen'
    );

    const listenerPort = 10_000 + Math.floor(Math.random() * 50_000);

    listenWebhookCommand
      .parseAsync(
        ['--url', 'https://tunnel.example.com', '--port', String(listenerPort)],
        { from: 'user' },
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 500));

    await postJSON(listenerPort, {
      type: 'email.sent',
      created_at: '2026-02-22T23:41:12.126Z',
      data: {
        email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
        message_id: '<111-222-333@email.example.com>',
        from: 'onboarding@resend.dev',
        to: ['delivered@resend.dev'],
        subject: 'Hello',
        created_at: '2026-02-22T23:41:11.894719+00:00',
      },
    });

    const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stderrOutput).toContain('56761188-7520-42d8-8898-ff6fc54ce618');
    expect(stderrOutput).toContain('<111-222-333@email.example.com>');

    stderrSpy.mockRestore();
  });
});
