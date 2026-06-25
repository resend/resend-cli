import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OAuthGrantData } from './config';
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

// /oauth/token response. token_type/expires_in are returned but unused (access
// expiry comes from the JWT exp); there is deliberately no refresh-token expiry.
export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type?: string;
  expires_in?: number;
};

// A 200 can still carry a non-token body (proxy/error pages); validate the fields
// we depend on before persisting a grant.
export function parseTokenResponse(json: unknown): TokenResponse {
  const invalid = new Error(
    'Received an unexpected response from Resend while authenticating. Please run `resend login` again.',
  );

  if (typeof json !== 'object' || json === null) {
    throw invalid;
  }

  const data = json as Record<string, unknown>;
  if (
    typeof data.access_token !== 'string' ||
    data.access_token.length === 0 ||
    typeof data.refresh_token !== 'string' ||
    data.refresh_token.length === 0 ||
    typeof data.scope !== 'string'
  ) {
    throw invalid;
  }

  return data as TokenResponse;
}

const TOKEN_REQUEST_TIMEOUT_MS = 30_000;

// fetch has no default timeout; abort after 30s so a hung connection can't hang
// the CLI.
async function fetchOAuthToken(
  url: string,
  body: URLSearchParams,
  label: string,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(
        `${label} timed out after 30s. Check your connection and try again.`,
      );
    }
    throw new Error(
      'Could not reach the Resend API. Check your connection and try again.',
    );
  }
}

export async function refreshOAuthGrant(
  grant: OAuthGrantData,
  profile: string,
): Promise<{ access_token: string; scope: string }> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (grant.access_token_expires_at > nowSeconds) {
    return { access_token: grant.access_token, scope: grant.scope };
  }

  // The refresh-token expiry isn't known client-side, so we can't pre-check it:
  // attempt the refresh and treat a non-OK response below as "log in again".
  const baseUrl = process.env.RESEND_BASE_URL ?? 'https://api.resend.com';
  const response = await fetchOAuthToken(
    `${baseUrl}/oauth/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: OAUTH_CLIENT_ID,
      refresh_token: grant.refresh_token,
    }),
    'Token refresh',
  );

  if (!response.ok) {
    throw new Error(
      `Token refresh failed (${response.status}). Please run \`resend login\` again.`,
    );
  }

  const data = parseTokenResponse(await response.json());

  await storeOAuthGrant(
    {
      access_token: data.access_token,
      access_token_expires_at: getJwtExp(data.access_token),
      refresh_token: data.refresh_token,
      scope: data.scope,
    },
    profile,
  );

  return { access_token: data.access_token, scope: data.scope };
}

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

function callbackPage(heading: string, message: string): string {
  return (
    '<!doctype html><html><head><title>Resend CLI</title></head>' +
    '<body style="font-family:system-ui;text-align:center;padding:2rem">' +
    `<h2>${heading}</h2>` +
    `<p>${message}</p>` +
    '</body></html>'
  );
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

      const failure = error
        ? `Authorization denied: ${error}`
        : !code || !state
          ? 'Missing code or state in OAuth callback'
          : null;

      const page = failure
        ? callbackPage(
            'Authentication failed',
            `${failure}. Return to your terminal and try again.`,
          )
        : callbackPage(
            'Authentication complete',
            'You can close this tab and return to your terminal.',
          );

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        Connection: 'close',
      });
      res.end(page, () => {
        req.socket.destroy();
      });

      server.close();
      clearTimeout(timeout);

      if (failure) {
        rejectCallback(new Error(failure));
      } else if (code && state) {
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
}): Promise<TokenResponse> {
  const response = await fetchOAuthToken(
    `${params.baseUrl}/oauth/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
    'Token exchange',
  );

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

  return parseTokenResponse(await response.json());
}
