import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenWebhookCommand } from '../../../src/commands/webhooks/listen';
import {
  captureTestEnv,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockCreate = vi.fn(async () => ({
  data: {
    object: 'webhook' as const,
    id: 'wh_test',
    signing_secret: 'whsec_dGVzdF9zZWNyZXQ=',
  },
  error: null,
}));
const mockRemove = vi.fn(async () => ({ data: null, error: null }));

vi.mock('resend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('resend')>();
  return {
    ...actual,
    Resend: class MockResend extends actual.Resend {
      constructor(key: string) {
        super(key);
        this.webhooks.create = mockCreate as typeof this.webhooks.create;
        this.webhooks.remove = mockRemove as typeof this.webhooks.remove;
      }
    },
  };
});

const postJSON = async (
  port: number,
  body: Record<string, unknown>,
  options: { signed?: boolean } = {},
): Promise<{ status: number; body: string }> => {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (options.signed !== false) {
    Object.assign(headers, signedHeaders(rawBody));
  }
  const resp = await fetch(`http://127.0.0.1:${port}`, {
    method: 'POST',
    headers,
    body: rawBody,
  });
  return { status: resp.status, body: await resp.text() };
};

const WEBHOOK_SECRET = 'whsec_dGVzdF9zZWNyZXQ=';
const signedHeaders = (rawBody: string) => {
  const id = 'msg_test';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const secret = Buffer.from(WEBHOOK_SECRET.slice('whsec_'.length), 'base64');
  const signature = createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');
  return {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  };
};

const startTargetServer = (
  responseStatus: number,
): Promise<{
  server: Server;
  port: number;
  requests: {
    count: number;
    headers?: Record<string, string | string[] | undefined>;
  };
}> =>
  new Promise((resolve) => {
    const requests: {
      count: number;
      headers?: Record<string, string | string[] | undefined>;
    } = { count: 0 };
    const server = createServer((req, res) => {
      requests.count += 1;
      requests.headers = req.headers;
      res.writeHead(responseStatus).end('target response');
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port, requests });
    });
  });

describe('webhook listen --forward-to status propagation', () => {
  const restoreEnv = captureTestEnv();
  let targetServer: Server | undefined;
  let outputLogSpy: ReturnType<typeof vi.spyOn> | undefined;
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

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

  const startListener = async (
    forwardPort: number,
    options: { interactive?: boolean } = {},
  ): Promise<number> => {
    setNonInteractive();
    ({ logSpy: outputLogSpy, stderrSpy } = setupOutputSpies());
    if (options.interactive) {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
      });
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
      });
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.TERM;
    }

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
    expect(target.requests.headers?.['svix-id']).toBe('msg_test');
    expect(target.requests.headers?.['svix-timestamp']).toBeTruthy();
    expect(target.requests.headers?.['svix-signature']).toMatch(/^v1,/);
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

  it('rejects requests without a signature before forwarding', async () => {
    const target = await startTargetServer(200);
    targetServer = target.server;
    const listenerPort = await startListener(target.port);

    const result = await postJSON(
      listenerPort,
      { type: 'email.sent', data: { id: 'evt_unsigned' } },
      { signed: false },
    );

    expect(result.status).toBe(400);
    expect(result.body).toBe('Invalid signature');
    expect(target.requests.count).toBe(0);
    expect(outputLogSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before forwarding', async () => {
    const target = await startTargetServer(200);
    targetServer = target.server;
    const listenerPort = await startListener(target.port);

    const rawBody = JSON.stringify({
      type: 'email.sent',
      data: { id: 'evt_invalid' },
    });
    const headers = signedHeaders(rawBody);
    headers['svix-signature'] = 'v1,invalid';
    const invalidResponse = await fetch(`http://127.0.0.1:${listenerPort}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: rawBody,
    });

    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.text()).toBe('Invalid signature');
    expect(target.requests.count).toBe(0);
    expect(outputLogSpy).not.toHaveBeenCalled();
  });

  it('shows the signing secret in the interactive banner', async () => {
    const target = await startTargetServer(200);
    targetServer = target.server;
    await startListener(target.port, { interactive: true });

    const banner = (stderrSpy?.mock.calls ?? [])
      .map((call) => String(call[0]))
      .join('')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI colors
      .replace(/\u001b\[[0-9;]*m/g, '');
    const lines = banner.split('\n');
    const webhookLine = lines.find((line) => line.includes('Webhook:'));
    const secretLine = lines.find((line) => line.includes(WEBHOOK_SECRET));
    expect(secretLine?.trim()).toBe(`Secret:   ${WEBHOOK_SECRET}`);
    expect(secretLine?.indexOf(WEBHOOK_SECRET)).toBe(
      webhookLine?.indexOf('wh_test'),
    );
    expect(outputLogSpy).not.toHaveBeenCalled();
  });
});
