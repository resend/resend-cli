import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureTestEnv,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

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
): Promise<{ status: number; body: string }> => {
  const resp = await fetch(`http://127.0.0.1:${port}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, body: await resp.text() };
};

const startTargetServer = (
  responseStatus: number,
): Promise<{ server: Server; port: number }> =>
  new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(responseStatus).end('target response');
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });

describe('webhook listen --forward-to status propagation', () => {
  const restoreEnv = captureTestEnv();
  let targetServer: Server | undefined;

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

    targetServer?.close();
    targetServer = undefined;
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  const startListener = async (forwardPort: number): Promise<number> => {
    setNonInteractive();
    setupOutputSpies();

    const { listenWebhookCommand } = await import(
      '../../../src/commands/webhooks/listen'
    );

    const listenerPort = 10_000 + Math.floor(Math.random() * 50_000);

    listenWebhookCommand
      .parseAsync(
        [
          '--url',
          'https://tunnel.example.com',
          '--port',
          String(listenerPort),
          '--forward-to',
          `http://127.0.0.1:${forwardPort}/webhook`,
        ],
        { from: 'user' },
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 500));

    return listenerPort;
  };

  it('returns 200 when forward target responds 200', async () => {
    const target = await startTargetServer(200);
    targetServer = target.server;
    const listenerPort = await startListener(target.port);

    const result = await postJSON(listenerPort, {
      type: 'email.sent',
      data: { id: 'evt_1' },
    });

    expect(result.status).toBe(200);
    expect(result.body).toBe('OK');
  });

  it('propagates 500 when forward target responds 500', async () => {
    const target = await startTargetServer(500);
    targetServer = target.server;
    const listenerPort = await startListener(target.port);

    const result = await postJSON(listenerPort, {
      type: 'email.sent',
      data: { id: 'evt_2' },
    });

    expect(result.status).toBe(500);
    expect(result.body).toBe('Forward target failed');
  });

  it('propagates 401 when forward target responds 401', async () => {
    const target = await startTargetServer(401);
    targetServer = target.server;
    const listenerPort = await startListener(target.port);

    const result = await postJSON(listenerPort, {
      type: 'email.sent',
      data: { id: 'evt_3' },
    });

    expect(result.status).toBe(401);
    expect(result.body).toBe('Forward target failed');
  });

  it('returns 502 when forward target is unreachable', async () => {
    setNonInteractive();
    setupOutputSpies();

    const { listenWebhookCommand } = await import(
      '../../../src/commands/webhooks/listen'
    );

    const listenerPort = 10_000 + Math.floor(Math.random() * 50_000);

    listenWebhookCommand
      .parseAsync(
        [
          '--url',
          'https://tunnel.example.com',
          '--port',
          String(listenerPort),
          '--forward-to',
          'http://127.0.0.1:1/unreachable',
        ],
        { from: 'user' },
      )
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 500));

    const result = await postJSON(listenerPort, {
      type: 'email.sent',
      data: { id: 'evt_4' },
    });

    expect(result.status).toBe(502);
    expect(result.body).toBe('Forward target unreachable');
  });
});
