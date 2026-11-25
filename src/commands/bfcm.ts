import { Command, Option } from '@commander-js/extra-typings';
import {
  BFCM_THEMES,
  BfcmRequestError,
  BfcmTokenUnavailableError,
  BfcmUnauthorizedError,
  runBfcmBoard,
} from '../lib/bfcm-board';
import { openInBrowser } from '../lib/browser';
import { setSigintHandler } from '../lib/cli-exit';
import type { GlobalOpts } from '../lib/client';
import { type ApiKeySource, resolveAuthentication } from '../lib/config';
import { buildHelpText } from '../lib/help-text';
import { OAUTH_NETWORK_ERROR_NAME, OAuthRefreshError } from '../lib/oauth';
import { errorMessage, outputError } from '../lib/output';
import { isInteractive } from '../lib/tty';

const DEFAULT_BFCM_URL = 'https://resend.com';

const LOGIN_HINT = 'Run `resend login --web` and try again.';

const API_KEY_HINTS: Record<ApiKeySource, string> = {
  flag: ' Remove --api-key.',
  env: ' Unset RESEND_API_KEY.',
  config: '',
  secure_storage: '',
};

function isTemporaryRefreshFailure(err: unknown): boolean {
  if (err instanceof OAuthRefreshError) {
    return err.status >= 500 || err.status === 408 || err.status === 429;
  }
  return err instanceof Error && err.name === OAUTH_NETWORK_ERROR_NAME;
}

export const bfcmCommand = new Command('bfcm')
  .description('Watch the live BFCM board for your team')
  .addOption(
    new Option('--theme <name>', 'Color theme to start with')
      .choices(BFCM_THEMES)
      .default('classic'),
  )
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Streams the live Black Friday / Cyber Monday board for the team you logged in to.
Needs an interactive terminal and a full access browser login from \`resend login --web\`. API keys do not work.

Keys: M next theme, S sound, R popup, X close popup, Q quit.
Open in your browser: H home, F Forge, E enterprise, G sign up, T Resend Studio.

Set BFCM_URL to stream the board from another host (default: ${DEFAULT_BFCM_URL}).`,
      errorCodes: [
        'not_interactive',
        'invalid_options',
        'not_authenticated',
        'oauth_required',
        'insufficient_permissions',
        'auth_error',
        'bfcm_unauthorized',
        'board_error',
      ],
      examples: ['resend bfcm', 'resend bfcm --theme amber'],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const json = globalOpts.json;

    if (json || !isInteractive()) {
      outputError(
        {
          message: json
            ? 'The BFCM board is interactive and does not support --json.'
            : 'The BFCM board needs an interactive terminal.',
          code: 'not_interactive',
        },
        { json },
      );
    }

    const baseUrl = process.env.BFCM_URL || DEFAULT_BFCM_URL;
    if (!URL.canParse(baseUrl)) {
      outputError(
        {
          message: `BFCM_URL is not a valid URL: ${baseUrl}`,
          code: 'invalid_options',
        },
        { json },
      );
    }

    let resolved: Awaited<ReturnType<typeof resolveAuthentication>>;
    try {
      resolved = await resolveAuthentication(
        globalOpts.apiKey,
        globalOpts.profile,
      );
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to read your login'),
          code: 'auth_error',
        },
        { json },
      );
    }

    if (!resolved) {
      outputError(
        { message: `Not logged in. ${LOGIN_HINT}`, code: 'not_authenticated' },
        { json },
      );
    }

    if (resolved.type === 'api_key') {
      outputError(
        {
          message: `The BFCM board needs a browser login, not an API key.${API_KEY_HINTS[resolved.source]} ${LOGIN_HINT}`,
          code: 'oauth_required',
        },
        { json },
      );
    }

    if (!resolved.scope.split(' ').includes('full_access')) {
      outputError(
        {
          message: `The BFCM board needs a full access login. ${LOGIN_HINT}`,
          code: 'insufficient_permissions',
        },
        { json },
      );
    }

    const grant = resolved;
    const stop = new AbortController();
    const onSignal = () => stop.abort();
    process.on('SIGTERM', onSignal);
    process.on('SIGHUP', onSignal);
    process.on('exit', onSignal);
    setSigintHandler(onSignal);

    try {
      await runBfcmBoard({
        baseUrl,
        theme: opts.theme,
        input: process.stdin,
        output: process.stdout,
        signal: stop.signal,
        openUrl: (url) => {
          void openInBrowser(url);
        },
        getAccessToken: async ({ force }) => {
          let refreshed: Awaited<ReturnType<typeof resolveAuthentication>>;
          try {
            refreshed = await resolveAuthentication(
              undefined,
              grant.profile,
              force ? { refresh: 'force' } : undefined,
            );
          } catch (err) {
            if (isTemporaryRefreshFailure(err)) {
              throw new BfcmTokenUnavailableError(err);
            }
            throw err;
          }
          if (refreshed?.type !== 'oauth_grant') {
            throw new Error(`Your login changed. ${LOGIN_HINT}`);
          }
          return refreshed.access_token;
        },
      });
    } catch (err) {
      outputError(
        err instanceof BfcmUnauthorizedError
          ? { message: err.message, code: 'bfcm_unauthorized' }
          : err instanceof BfcmRequestError
            ? { message: err.message, code: 'board_error' }
            : {
                message: errorMessage(err, 'The BFCM board stopped'),
                code: 'auth_error',
              },
        { json },
      );
    } finally {
      process.off('SIGTERM', onSignal);
      process.off('SIGHUP', onSignal);
      process.off('exit', onSignal);
    }
  });
