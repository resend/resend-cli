import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import { Resend } from 'resend';
import { openInBrowser } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import {
  type ApiKeyPermission,
  listProfiles,
  SENDING_KEY_MESSAGE,
  setActiveProfile,
  storeApiKeyAsync,
  storeOAuthGrant,
  validateProfileName,
} from '../../lib/config';
import { buildHelpText } from '../../lib/help-text';
import {
  createCallbackServer,
  exchangeAuthorizationCode,
  generatePKCE,
  getJwtExp,
  OAUTH_BASE_URL,
  OAUTH_CLIENT_ID,
} from '../../lib/oauth';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit, promptRenameIfInvalid } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

const RESEND_API_KEYS_URL = 'https://resend.com/api-keys?new=true';

async function selectProfile(
  globalOpts: GlobalOpts,
  promptLabel: string,
): Promise<string | undefined> {
  let profileName = globalOpts.profile?.trim() || undefined;

  if (profileName) {
    const profileError = validateProfileName(profileName);
    if (profileError) {
      outputError(
        { message: profileError, code: 'invalid_profile_name' },
        { json: globalOpts.json },
      );
    }
    return profileName;
  }

  if (!isInteractive() || globalOpts.json) {
    return profileName;
  }

  const existingProfiles = listProfiles();
  if (existingProfiles.length > 0) {
    const options = [
      ...existingProfiles.map((t) => ({
        value: t.name,
        label: `${t.name} (overwrite)`,
        hint: validateProfileName(t.name) ? 'invalid name' : undefined,
      })),
      { value: '__new__' as const, label: '+ Create new profile' },
    ];

    const choice = await p.select({ message: promptLabel, options });

    if (p.isCancel(choice)) {
      cancelAndExit('Login cancelled.');
    }

    if (choice === '__new__') {
      const newName = await p.text({
        message: 'Enter a name for the new profile:',
        validate: (v) => validateProfileName((v ?? '').trim()),
      });
      if (p.isCancel(newName)) {
        cancelAndExit('Login cancelled.');
      }
      profileName = (newName ?? '').trim() || 'default';
      const alreadyExists = existingProfiles.some(
        (pr) => pr.name === profileName,
      );
      if (alreadyExists) {
        const overwrite = await p.confirm({
          message: `Profile '${profileName}' already exists. Overwrite?`,
        });
        if (p.isCancel(overwrite) || !overwrite) {
          cancelAndExit('Login cancelled.');
        }
      }
    } else if (validateProfileName(choice)) {
      const renamed = await promptRenameIfInvalid(choice, globalOpts);
      if (!renamed) {
        return undefined;
      }
      profileName = renamed;
    } else {
      profileName = choice;
    }
  } else {
    profileName = 'default';
  }

  return profileName;
}

async function handleOAuthLogin(globalOpts: GlobalOpts): Promise<void> {
  const { codeVerifier, codeChallenge, state } = generatePKCE();

  const serverSpinner = createSpinner(
    'Starting local callback server...',
    globalOpts.quiet,
  );
  let port: number;
  let waitForCallback: Promise<{ code: string; state: string }>;
  try {
    ({ port, waitForCallback } = await createCallbackServer());
    serverSpinner.stop('');
  } catch (err) {
    serverSpinner.fail('Failed to start callback server');
    outputError(
      {
        message: errorMessage(err, 'Failed to start callback server'),
        code: 'oauth_error',
      },
      { json: globalOpts.json },
    );
  }

  const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;

  const authUrl = new URL(`${OAUTH_BASE_URL}/oauth/authorize`);
  authUrl.search = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'full_access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  const opened = await openInBrowser(authUrl.toString());
  if (opened) {
    p.log.info('Browser opened. Complete authentication to continue.');
  } else {
    p.log.warn(
      `Could not open browser. Visit this URL to authenticate:\n${authUrl.toString()}`,
    );
  }

  const waitSpinner = createSpinner(
    'Waiting for browser authentication...',
    globalOpts.quiet,
  );

  let callbackResult: { code: string; state: string };
  try {
    callbackResult = await waitForCallback;
  } catch (err) {
    waitSpinner.fail('Authentication failed');
    outputError(
      {
        message: errorMessage(err, 'Authentication failed'),
        code: 'oauth_error',
      },
      { json: globalOpts.json },
    );
  }

  if (callbackResult.state !== state) {
    waitSpinner.fail('Authentication failed');
    outputError(
      {
        message: 'State mismatch in OAuth callback. Possible CSRF attack.',
        code: 'oauth_state_mismatch',
      },
      { json: globalOpts.json },
    );
  }

  waitSpinner.stop('Browser authentication complete');

  const exchangeSpinner = createSpinner(
    'Exchanging authorization code...',
    globalOpts.quiet,
  );

  let tokenResponse: Awaited<ReturnType<typeof exchangeAuthorizationCode>>;
  try {
    tokenResponse = await exchangeAuthorizationCode({
      code: callbackResult.code,
      codeVerifier,
      redirectUri,
      clientId: OAUTH_CLIENT_ID,
      baseUrl: OAUTH_BASE_URL,
    });
  } catch (err) {
    exchangeSpinner.fail('Token exchange failed');
    outputError(
      {
        message: errorMessage(err, 'Token exchange failed'),
        code: 'oauth_error',
      },
      { json: globalOpts.json },
    );
  }

  exchangeSpinner.stop('Authenticated successfully');

  const profileName = await selectProfile(
    globalOpts,
    'Save credentials to which profile?',
  );
  const profileLabel = profileName || 'default';

  const nowSeconds = Math.floor(Date.now() / 1000);
  const configPath = await storeOAuthGrant(
    {
      access_token: tokenResponse.access_token,
      access_token_expires_at: getJwtExp(tokenResponse.access_token),
      refresh_token: tokenResponse.refresh_token,
      refresh_token_expires_at: tokenResponse.refresh_token_expires_in
        ? nowSeconds + tokenResponse.refresh_token_expires_in
        : nowSeconds + 30 * 24 * 60 * 60,
      scope: tokenResponse.scope,
    },
    profileName,
  );

  if (profileName) {
    try {
      setActiveProfile(profileLabel);
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to switch profile'),
          code: 'switch_failed',
        },
        { json: globalOpts.json },
      );
    }
  }

  if (globalOpts.json) {
    outputResult(
      {
        success: true,
        config_path: configPath,
        profile: profileLabel,
        scope: tokenResponse.scope,
      },
      { json: true },
    );
  } else {
    const msg = `Credentials stored for profile '${profileLabel}' at ${configPath}`;
    if (isInteractive()) {
      p.outro(msg);
    } else {
      console.log(msg);
    }
  }
}

export const loginCommand = new Command('login')
  .description('Save a Resend API key')
  .option('--key <key>', 'API key to store (required in non-interactive mode)')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context:
        'Non-interactive: --key is required (no prompts will appear when stdin/stdout is not a TTY).',
      output: `  {"success":true,"config_path":"<path>","profile":"<name>"}`,
      errorCodes: [
        'missing_key',
        'invalid_key_format',
        'validation_failed',
        'invalid_profile_name',
        'switch_failed',
        'write_failed',
        'oauth_error',
        'oauth_state_mismatch',
      ],
      examples: [
        'resend login --key re_123456789',
        'resend login                      (interactive — prompts and opens browser)',
        'RESEND_API_KEY=re_123 resend emails send ...  (skip login; use env var directly)',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    let apiKey = typeof opts.key === 'string' ? opts.key.trim() : opts.key;

    if (!apiKey) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          {
            message:
              'Missing --key flag. Provide your API key in non-interactive mode.',
            code: 'missing_key',
          },
          { json: globalOpts.json },
        );
      }

      p.intro('Resend Authentication');

      const method = await p.select({
        message: 'How would you like to authenticate?',
        options: [
          {
            value: 'oauth' as const,
            label: 'Login with Resend (opens browser)',
          },
          {
            value: 'browser' as const,
            label: 'Get API key from resend.com (opens browser)',
          },
          { value: 'manual' as const, label: 'Enter API key manually' },
        ],
      });

      if (p.isCancel(method)) {
        cancelAndExit('Login cancelled.');
      }

      if (method === 'oauth') {
        await handleOAuthLogin(globalOpts);
        return;
      }

      p.log.info(
        `Use a full access API key for complete CLI access.\n${SENDING_KEY_MESSAGE}`,
      );

      if (method === 'browser') {
        const opened = await openInBrowser(RESEND_API_KEYS_URL);
        if (opened) {
          p.log.info(`Opened ${RESEND_API_KEYS_URL}`);
        } else {
          p.log.warn(
            `Could not open browser. Visit ${RESEND_API_KEYS_URL} manually.`,
          );
        }
      }

      const result = await p.password({
        message: 'Enter your Resend API key:',
        validate: (value) => {
          if (!value) {
            return 'API key is required';
          }
          if (!value.startsWith('re_')) {
            return 'API key must start with re_';
          }
          return undefined;
        },
      });

      if (p.isCancel(result)) {
        cancelAndExit('Login cancelled.');
      }

      apiKey = result.trim();
    }

    if (!apiKey || !apiKey.startsWith('re_')) {
      outputError(
        {
          message: 'Invalid API key format. Key must start with re_',
          code: 'invalid_key_format',
        },
        { json: globalOpts.json },
      );
    }

    const spinner = createSpinner('Validating API key...', globalOpts.quiet);
    let detectedPermission: ApiKeyPermission = 'full_access';

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.domains.list();
      if (error) {
        const err = error as { name?: string; message?: string };
        if (err.name === 'restricted_api_key') {
          detectedPermission = 'sending_access';
          spinner.warn('API key is valid (sending access only)');
        } else {
          spinner.fail('API key validation failed');
          outputError(
            {
              message: err.message || 'Failed to validate API key',
              code: 'validation_failed',
            },
            { json: globalOpts.json },
          );
        }
      } else {
        spinner.stop('API key is valid (full access)');
      }
    } catch (err) {
      spinner.fail('API key validation failed');
      outputError(
        {
          message: errorMessage(err, 'Failed to validate API key'),
          code: 'validation_failed',
        },
        { json: globalOpts.json },
      );
    }

    const profileName = await selectProfile(
      globalOpts,
      'Save API key to which profile?',
    );

    const { configPath, backend } = await storeApiKeyAsync(
      apiKey,
      profileName,
      detectedPermission,
    );
    const profileLabel = profileName || 'default';

    if (profileName) {
      try {
        setActiveProfile(profileLabel);
      } catch (err) {
        outputError(
          {
            message: errorMessage(err, 'Failed to switch profile'),
            code: 'switch_failed',
          },
          { json: globalOpts.json },
        );
      }
    }

    if (globalOpts.json) {
      outputResult(
        {
          success: true,
          config_path: configPath,
          profile: profileLabel,
          storage: backend.name,
          permission: detectedPermission,
        },
        { json: true },
      );
    } else {
      const storageInfo = !backend.isSecure
        ? `at ${configPath}`
        : `in ${backend.name}`;
      const msg = `API key stored for profile '${profileLabel}' ${storageInfo}`;
      if (isInteractive()) {
        p.outro(msg);
      } else {
        console.log(msg);
      }

      if (!backend.isSecure && process.platform === 'linux') {
        const hint =
          'Tip: Install libsecret-tools and a Secret Service provider (e.g. gnome-keyring) to store keys in secure storage instead of a plaintext file.';
        if (isInteractive()) {
          p.log.info(hint);
        } else {
          console.log(hint);
        }
      }
    }
  });
