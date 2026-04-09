import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTestEnv, setNonInteractive } from '../../helpers';

const mockCreate = vi.fn(async () => ({
  data: {
    object: 'webhook' as const,
    id: 'wh_listen_test',
    signing_secret: 'whsec_test_secret',
  },
  error: null,
}));

const mockRemove = vi.fn(async () => ({
  data: { object: 'webhook' as const, id: 'wh_listen_test', deleted: true },
  error: null,
}));

const mockVerify = vi.fn((_payload: unknown) => ({
  type: 'email.sent',
  created_at: '2026-01-01T00:00:00.000Z',
  data: { id: 'email_123' },
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    webhooks = {
      create: mockCreate,
      remove: mockRemove,
      verify: mockVerify,
    };
  },
}));

let nextPort = 24900;

const postJSON = async (
  port: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> => {
  const resp = await fetch(`http://localhost:${port}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: resp.status, body: await resp.text() };
};

const waitForReady = async (port: number, retries = 40): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(`http://localhost:${port}`, { method: 'GET' });
      await new Promise((r) => setTimeout(r, 50));
      if (mockCreate.mock.calls.length > 0) {
        return;
      }
    } catch {
      // noop
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server on port ${port} did not become ready`);
};

describe('webhooks listen command', () => {
  const restoreEnv = captureTestEnv();
  let logSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    setNonInteractive();
    mockCreate.mockClear();
    mockRemove.mockClear();
    mockVerify.mockClear();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
    restoreEnv();
    vi.resetModules();
  });

  const startListener = async (extraArgs: readonly string[] = []) => {
    const port = nextPort++;
    const { listenWebhookCommand } = await import(
      '../../../src/commands/webhooks/listen'
    );
    listenWebhookCommand.parseAsync(
      [
        '--url',
        'https://tunnel.example.com',
        '--port',
        String(port),
        '--events',
        'email.sent',
        ...extraArgs,
      ],
      { from: 'user' },
    );
    await waitForReady(port);
    return port;
  };

  it('rejects requests with invalid signature (returns 401)', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const port = await startListener([
      '--forward-to',
      'localhost:19999/webhook',
    ]);

    const result = await postJSON(
      port,
      { type: 'email.sent', data: { id: 'email_fake' } },
      {
        'svix-id': 'msg_fake',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,fakesignature',
      },
    );

    expect(result.status).toBe(401);
    expect(result.body).toBe('Signature verification failed');
  });

  it('accepts requests with valid signature (returns 200)', async () => {
    mockVerify.mockReturnValue({
      type: 'email.sent',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { id: 'email_123' },
    });
    const port = await startListener();

    const result = await postJSON(
      port,
      { type: 'email.sent', data: { id: 'email_123' } },
      {
        'svix-id': 'msg_valid',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,validsignature',
      },
    );

    expect(result.status).toBe(200);
  });

  it('calls resend.webhooks.verify with correct parameters', async () => {
    const port = await startListener();

    const payload = { type: 'email.sent', data: { id: 'email_123' } };
    await postJSON(port, payload, {
      'svix-id': 'msg_abc',
      'svix-timestamp': '9999999999',
      'svix-signature': 'v1,testsig',
    });

    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledWith({
      payload: JSON.stringify(payload),
      headers: {
        id: 'msg_abc',
        timestamp: '9999999999',
        signature: 'v1,testsig',
      },
      webhookSecret: 'whsec_test_secret',
    });
  });

  it('skips verification with --insecure-forward flag', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const port = await startListener(['--insecure-forward']);

    const result = await postJSON(
      port,
      { type: 'email.sent', data: { id: 'email_123' } },
      {
        'svix-id': 'msg_fake',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,badsig',
      },
    );

    expect(result.status).toBe(200);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('outputs verification failure in JSON mode', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const port = await startListener();

    await postJSON(
      port,
      { type: 'email.sent', data: { id: 'email_fake' } },
      {
        'svix-id': 'msg_fake',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,badsig',
      },
    );

    const jsonOutputCalls = logSpy.mock.calls.filter((c) => {
      try {
        const parsed = JSON.parse(c[0] as string);
        return parsed.error === 'signature_verification_failed';
      } catch {
        return false;
      }
    });
    expect(jsonOutputCalls).toHaveLength(1);
  });

  it('captures signing_secret from webhook creation', async () => {
    await startListener();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('does not forward when verification fails', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const receivedRequests: unknown[] = [];
    const { createServer } = await import('node:http');
    const targetPort = nextPort++;
    const targetServer = createServer((_req, res) => {
      receivedRequests.push(true);
      res.writeHead(200).end('OK');
    });
    await new Promise<void>((resolve) =>
      targetServer.listen(targetPort, resolve),
    );

    try {
      const port = await startListener([
        '--forward-to',
        `localhost:${targetPort}/webhook`,
      ]);

      await postJSON(
        port,
        { type: 'email.sent', data: { id: 'email_fake' } },
        {
          'svix-id': 'msg_fake',
          'svix-timestamp': '1234567890',
          'svix-signature': 'v1,fakesig',
        },
      );

      expect(receivedRequests).toHaveLength(0);
    } finally {
      targetServer.close();
    }
  });
});
