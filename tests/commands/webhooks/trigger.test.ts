import { createServer, type IncomingMessage, type Server } from 'node:http';
import { Resend } from 'resend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webhooksCommand } from '../../../src/commands/webhooks';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

const WEBHOOK_SECRET = `whsec_${Buffer.from('local-development-secret').toString('base64')}`;
const DELIVERY_ID = 'msg_local_repeatable_delivery_1';

type CapturedRequest = {
  body: string;
  headers: IncomingMessage['headers'];
};

describe('webhooks trigger command', () => {
  const restoreEnv = captureTestEnv();
  const servers: Server[] = [];
  let exitSpy: ReturnType<typeof mockExitThrow> | undefined;

  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.RESEND_TELEMETRY_DISABLED = '1';
    process.env.RESEND_NO_UPDATE_NOTIFIER = '1';
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_PROFILE;
  });

  afterEach(async () => {
    exitSpy?.mockRestore();
    exitSpy = undefined;
    vi.restoreAllMocks();
    restoreEnv();
    for (const server of servers.splice(0)) {
      if (server.listening) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  });

  const invoke = (args: string[]) =>
    webhooksCommand.parseAsync(['trigger', ...args], { from: 'user' });

  const expectCommandError = async (
    args: string[],
    expectedMessage: string,
  ): Promise<string> => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    await expectExit1(() => invoke(args));
    const errorText = errorSpy.mock.calls.map((call) => call[0]).join(' ');
    expect(errorText).toContain(expectedMessage);
    return errorText;
  };

  const startServer = async (
    handler: (
      req: IncomingMessage,
      res: import('node:http').ServerResponse,
    ) => void,
  ): Promise<{ url: string; server: Server }> => {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP server address');
    }
    return { server, url: `http://127.0.0.1:${address.port}/webhooks/resend` };
  };

  const captureServer = async (): Promise<{
    requests: CapturedRequest[];
    url: string;
  }> => {
    const requests: CapturedRequest[] = [];
    const target = await startServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        requests.push({
          body: Buffer.concat(chunks).toString('utf8'),
          headers: req.headers,
        });
        res.writeHead(200).end('accepted');
      });
    });
    return { requests, url: target.url };
  };

  const verifyRequest = (request: CapturedRequest, secret = WEBHOOK_SECRET) =>
    new Resend('unused').webhooks.verify({
      payload: request.body,
      headers: {
        id: String(request.headers['svix-id']),
        timestamp: String(request.headers['svix-timestamp']),
        signature: String(request.headers['svix-signature']),
      },
      webhookSecret: secret,
    });

  const runSuccessfully = async (args: string[]) => {
    const output = setupOutputSpies();
    await invoke(args);
    return {
      output,
      result: JSON.parse(String(output.logSpy.mock.calls[0][0])) as Record<
        string,
        unknown
      >,
    };
  };

  it('posts a synthetic event that the Resend SDK verifies without API credentials', async () => {
    const target = await captureServer();

    const { result } = await runSuccessfully([
      'email.delivered',
      '--forward-to',
      target.url,
    ]);

    expect(target.requests).toHaveLength(1);
    const request = target.requests[0];
    const event = verifyRequest(request);
    expect(event.type).toBe('email.delivered');
    if (event.type !== 'email.delivered') {
      throw new Error('Expected an email.delivered fixture');
    }
    expect(event.data.from).toBe('sender@example.test');
    expect(event.data.to).toEqual(['recipient@example.test']);
    expect(event.data.broadcast_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.data.template_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.data.tags).toEqual({ category: 'resend-cli-local-test' });
    expect(event.data.email_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.data.message_id).toMatch(
      /^<[0-9a-f-]{36}@email\.example\.test>$/,
    );
    expect(Date.parse(event.data.created_at)).toBeLessThan(
      Date.parse(event.created_at),
    );
    expect(Date.parse(event.created_at)).toBeLessThanOrEqual(Date.now());
    expect(result.delivery_id).toMatch(/^msg_local_/);
    expect(result.delivery_id).toBe(request.headers['svix-id']);
    expect(result.delivery_id).not.toBe(event.data.email_id);
    expect(result).toMatchObject({
      synthetic: true,
      event_type: 'email.delivered',
      http_status: 200,
      response_body: 'accepted',
      response_truncated: false,
    });
    expect(request.headers['content-type']).toBe('application/json');
  });

  it.each([
    'email.delivered',
    'email.bounced',
    'email.complained',
  ] as const)('builds an SDK-compatible %s fixture', async (eventType) => {
    const target = await captureServer();
    await runSuccessfully([eventType, '--forward-to', target.url]);

    const event = verifyRequest(target.requests[0]);
    expect(event.type).toBe(eventType);
    if (eventType === 'email.bounced') {
      expect(event.data.bounce).toEqual({
        type: 'Permanent',
        subType: 'General',
        message: 'Synthetic bounce for local webhook testing',
      });
    }
  });

  it('generates and overrides the documented email event fields using focused options', async () => {
    const target = await captureServer();
    await runSuccessfully([
      'email.delivered',
      '--forward-to',
      target.url,
      '--email-id',
      'email_app_fixture_42',
      '--message-id',
      '<app-message@example.test>',
      '--from',
      'QA Sender <qa@example.test>',
      '--to',
      'first@example.test',
      'second@example.test',
      '--subject',
      'Order ready',
      '--broadcast-id',
      'broadcast_app_fixture_7',
      '--template-id',
      'template_app_fixture_9',
      '--tag',
      'category=transactional',
      '--tag',
      'order_id=order_123',
    ]);

    const event = verifyRequest(target.requests[0]);
    if (event.type !== 'email.delivered') {
      throw new Error('Expected an email.delivered fixture');
    }
    expect(event.data).toMatchObject({
      email_id: 'email_app_fixture_42',
      message_id: '<app-message@example.test>',
      from: 'QA Sender <qa@example.test>',
      to: ['first@example.test', 'second@example.test'],
      subject: 'Order ready',
      broadcast_id: 'broadcast_app_fixture_7',
      template_id: 'template_app_fixture_9',
      tags: { category: 'transactional', order_id: 'order_123' },
    });
  });

  it('overrides bounce details while preserving the Resend event shape', async () => {
    const target = await captureServer();
    await runSuccessfully([
      'email.bounced',
      '--forward-to',
      target.url,
      '--bounce-type',
      'Transient',
      '--bounce-sub-type',
      'MailboxFull',
      '--bounce-message',
      'Synthetic mailbox full condition',
    ]);

    const event = verifyRequest(target.requests[0]);
    if (event.type !== 'email.bounced') {
      throw new Error('Expected an email.bounced fixture');
    }
    expect(event.data.bounce).toEqual({
      type: 'Transient',
      subType: 'MailboxFull',
      message: 'Synthetic mailbox full condition',
    });
  });

  it('supports fixed timestamps and rejects malformed timestamp overrides', async () => {
    const target = await captureServer();
    await runSuccessfully([
      'email.delivered',
      '--forward-to',
      target.url,
      '--event-created-at',
      '2026-10-23T12:00:00.000Z',
      '--email-created-at',
      '2026-10-23T11:59:00.000Z',
    ]);

    const event = verifyRequest(target.requests[0]);
    expect(event.created_at).toBe('2026-10-23T12:00:00.000Z');
    expect(event.data.created_at).toBe('2026-10-23T11:59:00.000Z');

    await expectCommandError(
      [
        'email.delivered',
        '--forward-to',
        'http://127.0.0.1:3000/webhook',
        '--event-created-at',
        '2026-10-23',
      ],
      'valid ISO 8601 timestamp',
    );
  });

  it('rejects bounce-only overrides on other event types', async () => {
    await expectCommandError(
      [
        'email.delivered',
        '--forward-to',
        'http://127.0.0.1:3000/webhook',
        '--bounce-type',
        'Transient',
      ],
      'only apply to email.bounced',
    );
  });

  it('rejects malformed or duplicate tag overrides', async () => {
    await expectCommandError(
      [
        'email.delivered',
        '--forward-to',
        'http://127.0.0.1:3000/webhook',
        '--tag',
        'missing-value',
      ],
      'name=value',
    );
    await expectCommandError(
      [
        'email.delivered',
        '--forward-to',
        'http://127.0.0.1:3000/webhook',
        '--tag',
        'category=first',
        '--tag',
        'category=second',
      ],
      'provided more than once',
    );
  });

  it('rejects unsupported event types and names the available fixtures', async () => {
    const error = await expectCommandError(
      ['email.opened', '--forward-to', 'http://127.0.0.1:3000/webhook'],
      'email.delivered',
    );
    expect(error).toContain('email.bounced');
    expect(error).toContain('email.complained');
  });

  it('requires RESEND_WEBHOOK_SECRET and never prints a missing or invalid secret', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    await expectCommandError(
      ['email.delivered', '--forward-to', 'http://127.0.0.1:3000/webhook'],
      'RESEND_WEBHOOK_SECRET',
    );
  });

  it('rejects malformed webhook secrets without echoing their value', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'do-not-print-this-secret';
    const error = await expectCommandError(
      ['email.delivered', '--forward-to', 'http://127.0.0.1:3000/webhook'],
      'RESEND_WEBHOOK_SECRET',
    );
    expect(error).not.toContain('do-not-print-this-secret');
  });

  it.each([
    'file:///tmp/payload.json',
    'http://user:password@127.0.0.1:3000/webhook',
    'not a URL',
  ])('rejects an unsafe or invalid destination URL: %s', async (url) => {
    await expectCommandError(['email.delivered', '--forward-to', url], 'URL');
  });

  it('rejects a delivery ID that cannot safely be placed in an HTTP header', async () => {
    await expectCommandError(
      [
        'email.delivered',
        '--forward-to',
        'http://127.0.0.1:3000/webhook',
        '--delivery-id',
        'bad\r\nid',
      ],
      'delivery ID',
    );
  });

  it('uses a supplied delivery ID unchanged across repeated deliveries', async () => {
    const target = await captureServer();
    const args = [
      'email.delivered',
      '--forward-to',
      target.url,
      '--delivery-id',
      DELIVERY_ID,
    ];

    await runSuccessfully(args);
    await runSuccessfully(args);

    expect(target.requests).toHaveLength(2);
    expect(
      target.requests.map((request) => request.headers['svix-id']),
    ).toEqual([DELIVERY_ID, DELIVERY_ID]);
    expect(verifyRequest(target.requests[0]).type).toBe('email.delivered');
    expect(verifyRequest(target.requests[1]).type).toBe('email.delivered');
  });

  it('shows the signed request in dry-run mode without making a POST or exposing the secret', async () => {
    const target = await captureServer();
    const { result } = await runSuccessfully([
      'email.bounced',
      '--forward-to',
      target.url,
      '--delivery-id',
      DELIVERY_ID,
      '--dry-run',
    ]);

    expect(target.requests).toHaveLength(0);
    expect(result).toMatchObject({
      synthetic: true,
      dry_run: true,
      event_type: 'email.bounced',
      delivery_id: DELIVERY_ID,
      method: 'POST',
      url: target.url,
    });
    expect(result).toHaveProperty('headers.content-type', 'application/json');
    expect(result).toHaveProperty('headers.svix-id', DELIVERY_ID);
    expect(result).toHaveProperty('headers.svix-signature');
    expect(result).toHaveProperty('body');
    expect(JSON.stringify(result)).not.toContain(WEBHOOK_SECRET);
  });

  it('accepts an HTTPS destination in dry-run mode', async () => {
    const { result } = await runSuccessfully([
      'email.delivered',
      '--forward-to',
      'https://localhost:8443/webhooks/resend',
      '--dry-run',
    ]);

    expect(result.url).toBe('https://localhost:8443/webhooks/resend');
    expect(result.method).toBe('POST');
  });

  it('rejects a modified body and the wrong secret using the official verifier', async () => {
    const target = await captureServer();
    await runSuccessfully(['email.delivered', '--forward-to', target.url]);
    const request = target.requests[0];

    expect(() =>
      verifyRequest({ ...request, body: `${request.body} ` }),
    ).toThrow();
    expect(() =>
      verifyRequest(
        request,
        `whsec_${Buffer.from('different-secret').toString('base64')}`,
      ),
    ).toThrow();

    const expired = {
      ...request,
      headers: {
        ...request.headers,
        'svix-timestamp': '1',
      },
    };
    expect(() => verifyRequest(expired)).toThrow(/too old/i);
  });

  it('fails when the endpoint returns a non-2xx response', async () => {
    const target = await startServer((_req, res) => {
      res.writeHead(500).end('handler failed');
    });
    await expectCommandError(
      ['email.delivered', '--forward-to', target.url],
      'HTTP 500',
    );
  });

  it('reports a connection failure without exposing runtime details', async () => {
    const target = await startServer((_req, res) => {
      res.writeHead(200).end();
    });
    await new Promise<void>((resolve) => target.server.close(() => resolve()));

    const error = await expectCommandError(
      ['email.delivered', '--forward-to', target.url],
      'Could not connect to the webhook endpoint',
    );
    expect(error).not.toContain(WEBHOOK_SECRET);
  });

  it('does not follow redirects', async () => {
    let redirectedRequests = 0;
    const destination = await startServer((_req, res) => {
      redirectedRequests += 1;
      res.writeHead(200).end('must not be reached');
    });
    const redirect = await startServer((_req, res) => {
      res.writeHead(307, { location: destination.url }).end();
    });

    await expectCommandError(
      ['email.delivered', '--forward-to', redirect.url],
      'HTTP 307',
    );
    expect(redirectedRequests).toBe(0);
  });

  it('truncates large endpoint response bodies', async () => {
    const target = await startServer((_req, res) => {
      res.writeHead(200).end('x'.repeat(5000));
    });
    const { result } = await runSuccessfully([
      'email.delivered',
      '--forward-to',
      target.url,
    ]);

    expect(result.response_body).toHaveLength(4096);
    expect(result.response_truncated).toBe(true);
  });

  it('fails a target that never responds within the request timeout', async () => {
    const target = await startServer(() => {});
    const started = Date.now();
    await expectCommandError(
      ['email.delivered', '--forward-to', target.url],
      'timed out',
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(9000);
  }, 15_000);
});
