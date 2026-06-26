import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AUTH_BACKGROUND_DATA_URI } from './oauth-background';
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

const TOKEN_EXPIRY_LEEWAY_SECONDS = 60;

// Marks errors from a timed-out or unreachable token request (vs. the server
// rejecting the request), so callers can treat them as transient.
export const OAUTH_NETWORK_ERROR_NAME = 'OAuthNetworkError';

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
    const message =
      err instanceof Error && err.name === 'TimeoutError'
        ? `${label} timed out after 30s. Check your connection and try again.`
        : 'Could not reach the Resend API. Check your connection and try again.';
    const networkError = new Error(message);
    networkError.name = OAUTH_NETWORK_ERROR_NAME;
    throw networkError;
  }
}

export async function refreshOAuthGrant(
  grant: OAuthGrantData,
  profile: string,
): Promise<{ access_token: string; scope: string }> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    grant.access_token_expires_at >
    nowSeconds + TOKEN_EXPIRY_LEEWAY_SECONDS
  ) {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The Resend logomark, inlined from apps/dashboard/src/ui/logo.tsx so the page
// stays self-contained (the local callback server has no asset pipeline). The
// gradient ids are suffixed to avoid any collision if the page is embedded.
const LOGOMARK_SVG = `<svg class="logo" role="img" aria-label="Resend" fill="none" viewBox="0 0 78 78" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="76" height="76" rx="21" stroke="#FDFDFD" stroke-opacity="0.1" stroke-width="2" />
  <path d="M43.0184 21C49.9908 21 54.1374 25.1467 54.1374 30.6513C54.1374 36.1558 49.9908 40.3025 43.0184 40.3025H39.4953L57 57H44.6329L31.3118 44.3394C30.3578 43.4587 29.9174 42.4312 29.9174 41.5506C29.9174 40.3029 30.7984 39.202 32.4864 38.7249L39.3485 36.8897C41.954 36.1925 43.7522 34.1741 43.7522 31.5319C43.7522 28.3027 41.1098 26.4312 37.8438 26.4312H21V21H43.0184Z" fill="url(#resend_cli_logo_a)" />
  <path d="M54.1375 30.6513C54.1374 25.1467 49.9908 21 43.0184 21V20.55C46.5934 20.55 49.4879 21.6142 51.4941 23.4275C53.4405 25.1867 54.5189 27.6229 54.5844 30.3832L54.5875 30.6513C54.5875 33.5218 53.5032 36.0591 51.4941 37.875C49.5505 39.6317 46.7734 40.6853 43.3515 40.7495L43.0184 40.7525H40.619L58.1237 57.45H44.4532L44.3231 57.3261L31.0064 44.6694C29.978 43.7199 29.4675 42.579 29.4674 41.5506C29.4674 40.0491 30.5379 38.8082 32.3643 38.292L32.37 38.2903L39.2321 36.4551C41.6742 35.8016 43.3023 33.9377 43.3023 31.5319C43.3023 30.0523 42.7022 28.9051 41.7383 28.1191C40.7652 27.3258 39.3949 26.8812 37.8438 26.8812H20.55V20.55H43.0184V21H21V26.4312H37.8438C41.1098 26.4312 43.7522 28.3027 43.7523 31.5319C43.7523 34.1741 41.954 36.1925 39.3485 36.8897L32.4865 38.7249C30.7984 39.202 29.9174 40.3029 29.9174 41.5506C29.9175 42.4312 30.3578 43.4587 31.3118 44.3393L44.633 57H57.0001L39.4953 40.3025H43.0184C49.9909 40.3025 54.1375 36.1558 54.1375 30.6513Z" fill="url(#resend_cli_logo_b)" />
  <defs>
    <linearGradient id="resend_cli_logo_a" x1="39" y1="21" x2="58.1887" y2="56.4242" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FDFDFD" />
      <stop offset="1" stop-color="#ADADAD" />
    </linearGradient>
    <linearGradient id="resend_cli_logo_b" x1="39.3369" y1="20.55" x2="58.8097" y2="57.1549" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FDFDFD" />
      <stop offset="1" stop-color="#ADADAD" />
    </linearGradient>
  </defs>
</svg>`;

// Self-contained, dark-themed page matching the dashboard auth screens
// (apps/dashboard/src/app/(auth)). No external assets: CSS, fonts (system
// stack), and the logo SVG are all inlined so it renders offline on 127.0.0.1.
function callbackPage(opts: { heading: string; message: string }): string {
  const heading = escapeHtml(opts.heading);
  const message = escapeHtml(opts.message);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Resend CLI</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background-color: #000;
    color: #a1a4a5;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  /* Decorative silk background, mirrored from the dashboard auth layout:
     full-bleed cover, dimmed on small screens so it never crowds the text. */
  .bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    user-select: none;
    background-image: url("${AUTH_BACKGROUND_DATA_URI}");
    background-size: cover;
    background-position: center;
    opacity: 0.2;
  }
  @media (min-width: 640px) {
    .bg { opacity: 1; }
  }
  main {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 28rem;
    text-align: center;
  }
  .logo { width: 48px; height: 48px; display: inline-block; }
  h1 {
    margin: 1.5rem 0 0;
    font-size: 28px;
    line-height: 34px;
    letter-spacing: -0.045rem;
    font-weight: 500;
    color: #f0f0f0;
    text-wrap: balance;
  }
  p {
    margin: 0.75rem 0 0;
    font-size: 15px;
    line-height: 1.5;
    color: #a1a4a5;
    text-wrap: balance;
  }
</style>
</head>
<body>
<div class="bg"></div>
<main>
  ${LOGOMARK_SVG}
  <h1>${heading}</h1>
  <p>${message}</p>
</main>
</body>
</html>`;
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

      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404, { Connection: 'close' });
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      const failure = error
        ? `Authorization denied: ${error}`
        : !code || !state
          ? 'Missing code or state in OAuth callback'
          : null;

      const page = failure
        ? callbackPage({
            heading: 'Authentication failed',
            message: `${failure}. Return to your terminal and try again.`,
          })
        : callbackPage({
            heading: 'Authentication complete',
            message: 'You can close this tab and return to your terminal.',
          });

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
