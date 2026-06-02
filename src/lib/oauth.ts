import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { URL } from 'node:url';

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

export type PKCEValues = {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
};

export function generatePKCE(): PKCEValues {
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(
    createHash('sha256').update(codeVerifier).digest(),
  );
  const state = base64url(randomBytes(24));
  return { codeVerifier, codeChallenge, state };
}

export async function registerClient(
  baseUrl: string,
  scope: string,
  redirectUri: string,
): Promise<{ client_id: string }> {
  const response = await fetch(`${baseUrl}/oauth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_name: 'Resend CLI',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Client registration failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { client_id: string };
  return { client_id: data.client_id };
}

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  scope: string;
};

export async function exchangeCode(opts: {
  baseUrl: string;
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: opts.clientId,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });

  const response = await fetch(`${opts.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    scope: data.scope,
  };
}

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export async function refreshAccessToken(opts: {
  baseUrl: string;
  clientId: string;
  refreshToken: string;
}): Promise<RefreshResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: opts.clientId,
    refresh_token: opts.refreshToken,
  });

  const response = await fetch(`${opts.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function revokeToken(opts: {
  baseUrl: string;
  clientId: string;
  token: string;
}): Promise<void> {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    token: opts.token,
    token_type_hint: 'refresh_token',
  });

  await fetch(`${opts.baseUrl}/oauth/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  }).catch(() => {});
}

export type CallbackServer = {
  port: number;
  redirectUri: string;
  waitForCallback(): Promise<{ code: string; state: string }>;
  close(): void;
};

export function startCallbackServer(): Promise<CallbackServer> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    // server.close() stops new connections but keeps existing sockets alive,
    // which holds the event loop. closeAllConnections() destroys open sockets
    // so the process can exit cleanly (requires Node >=18.2, project needs 22).
    const forceClose = () => {
      server.closeAllConnections();
      server.close();
    };

    let resolveCallback:
      | ((val: { code: string; state: string }) => void)
      | null = null;
    let rejectCallback: ((err: Error) => void) | null = null;

    const callbackPromise = new Promise<{ code: string; state: string }>(
      (res, rej) => {
        resolveCallback = res;
        rejectCallback = rej;
      },
    );

    const timeout = setTimeout(() => {
      rejectCallback?.(
        new Error(
          'OAuth callback timed out after 60 seconds. Run: resend login --oauth',
        ),
      );
      forceClose();
    }, 60_000);

    server.on('request', (req, res) => {
      try {
        const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (reqUrl.pathname !== '/oauth/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const errorParam = reqUrl.searchParams.get('error');
        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');

        const html = (title: string, body: string) =>
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:500px;margin:80px auto;padding:0 20px;color:#111}</style></head><body><h1>${title}</h1><p>${body}</p></body></html>`;

        if (errorParam) {
          const desc =
            reqUrl.searchParams.get('error_description') ?? errorParam;
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(html('Authorization failed', desc));
          clearTimeout(timeout);
          rejectCallback?.(new Error(`Authorization denied: ${desc}`));
          forceClose();
          return;
        }

        if (!code || !state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(
            html('Authorization failed', 'Missing code or state parameter.'),
          );
          clearTimeout(timeout);
          rejectCallback?.(new Error('Missing code or state in callback'));
          forceClose();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          html(
            'Authorization successful',
            'You can close this tab and return to your terminal.',
          ),
        );

        clearTimeout(timeout);
        resolveCallback?.({ code, state });
        // Small delay so the browser receives the response before we kill the socket
        setTimeout(forceClose, 500);
      } catch (err) {
        res.writeHead(500);
        res.end('Internal error');
        clearTimeout(timeout);
        rejectCallback?.(
          err instanceof Error ? err : new Error(String(err)),
        );
        forceClose();
      }
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind callback server'));
        return;
      }
      const port = address.port;
      resolve({
        port,
        redirectUri: `http://127.0.0.1:${port}/oauth/callback`,
        waitForCallback: () => callbackPromise,
        close: () => {
          clearTimeout(timeout);
          forceClose();
        },
      });
    });
  });
}
