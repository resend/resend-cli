import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OAuthGrant } from './config';
import { storeOAuthGrant } from './config';

export const OAUTH_CLIENT_ID = '7136aa0b-625c-4c9c-8820-e9784c8eb141';

const INVALID_TOKEN_MESSAGE =
  'Received an invalid access token from Resend. Please run `resend login` to authenticate again.';

export function getJwtExp(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as { exp?: unknown }).exp !== 'number'
  ) {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  return (decoded as { exp: number }).exp;
}

export async function refreshOAuthGrant(
  grant: OAuthGrant,
  profile: string,
): Promise<{ access_token: string; scope: string }> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (grant.access_token_expires_at > nowSeconds) {
    return { access_token: grant.access_token, scope: grant.scope };
  }

  if (grant.refresh_token_expires_at <= nowSeconds) {
    throw new Error(
      'Your session has expired. Please run `resend login` to authenticate again.',
    );
  }

  const baseUrl = process.env.RESEND_BASE_URL ?? 'https://api.resend.com';
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: OAUTH_CLIENT_ID,
      refresh_token: grant.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Token refresh failed (${response.status}). Please run \`resend login\` again.`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    refresh_token_expires_in: number;
  };

  const newAccessTokenExpiresAt = getJwtExp(data.access_token);
  const newRefreshTokenExpiresAt = nowSeconds + data.refresh_token_expires_in;

  await storeOAuthGrant(
    {
      access_token: data.access_token,
      access_token_expires_at: newAccessTokenExpiresAt,
      refresh_token: data.refresh_token,
      refresh_token_expires_at: newRefreshTokenExpiresAt,
      scope: data.scope,
    },
    profile,
  );

  return { access_token: data.access_token, scope: data.scope };
}

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

export function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
} {
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(
    createHash('sha256').update(codeVerifier).digest(),
  );
  const state = base64url(randomBytes(24));
  return { codeVerifier, codeChallenge, state };
}

export function createCallbackServer(): Promise<{
  port: number;
  waitForCallback: Promise<{ code: string; state: string }>;
}> {
  return new Promise((resolveSetup, rejectSetup) => {
    let resolveCallback!: (v: { code: string; state: string }) => void;
    let rejectCallback!: (e: Error) => void;

    const waitForCallback = new Promise<{ code: string; state: string }>(
      (resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;
      },
    );

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        Connection: 'close',
      });
      res.end(
        '<!doctype html><html><head><title>Resend CLI</title></head>' +
          '<body style="font-family:system-ui;text-align:center;padding:2rem">' +
          '<h2>Authentication complete</h2>' +
          '<p>You can close this tab and return to your terminal.</p>' +
          '</body></html>',
        () => {
          req.socket.destroy();
        },
      );

      server.close();
      clearTimeout(timeout);

      if (error) {
        rejectCallback(new Error(`Authorization denied: ${error}`));
      } else if (!code || !state) {
        rejectCallback(new Error('Missing code or state in OAuth callback'));
      } else {
        resolveCallback({ code, state });
      }
    });

    const timeout = setTimeout(
      () => {
        server.close();
        rejectCallback(
          new Error('OAuth login timed out after 5 minutes. Please try again.'),
        );
      },
      5 * 60 * 1000,
    );

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolveSetup({ port, waitForCallback });
    });

    server.on('error', rejectSetup);
  });
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  baseUrl: string;
}): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  refresh_token_expires_in: number;
}> {
  const response = await fetch(`${params.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as {
        error_description?: string;
        error?: string;
      };
      detail = body.error_description ?? body.error ?? '';
    } catch {}
    throw new Error(
      `Token exchange failed (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    refresh_token_expires_in: number;
  }>;
}
