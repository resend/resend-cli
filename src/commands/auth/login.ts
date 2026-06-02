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
  storeOAuthProfile,
  validateProfileName,
} from '../../lib/config';
import { buildHelpText } from '../../lib/help-text';
import {
  exchangeCode,
  generatePKCE,
  registerClient,
  startCallbackServer,
} from '../../lib/oauth';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit, promptRenameIfInvalid } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

const RESEND_API_KEYS_URL = 'https://resend.com/api-keys?new=true';
const OAUTH_DEFAULT_BASE_URL = 'https://api.resend-staging.com';
const OAUTH_DEFAULT_SCOPE = 'full_access';

async function handleOAuthLogin(
  globalOpts: GlobalOpts,
  baseUrl: string,
  scope: string,
): Promise<void> {
  if (!isInteractive() || globalOpts.json) {
    outputError(
      {
        message:
          'OAuth login requires an interactive terminal with a browser. Use --key for non-interactive authentication.',
        code: 'oauth_non_interactive',
      },
      { json: globalOpts.json },
    );
    return;
  }

  p.intro('Resend OAuth Authentication (staging)');
  p.log.info(
    `Authenticating against ${baseUrl}\nScope: ${scope}`,
  );

  const spinner = createSpinner('Starting local callback server...', globalOpts.quiet);
  let callbackServer: Awaited<ReturnType<typeof startCallbackServer>>;
  try {
    callbackServer = await startCallbackServer();
    spinner.stop(`Callback server listening on port ${callbackServer.port}`);
  } catch (err) {
    spinner.fail('Failed to start callback server');
    outputError(
      {
        message: errorMessage(err, 'Failed to start callback server'),
        code: 'oauth_server_error',
      },
      { json: globalOpts.json },
    );
    return;
  }

  const { codeVerifier, codeChallenge, state } = generatePKCE();

  const registerSpinner = createSpinner('Registering OAuth client...', globalOpts.quiet);
  let clientId: string;
  try {
    // Register with the exact port-specific URI; staging requires an exact match
    const { client_id } = await registerClient(
      baseUrl,
      scope,
      callbackServer.redirectUri,
    );
    clientId = client_id;
    registerSpinner.stop(`Client registered: ${clientId}`);
  } catch (err) {
    registerSpinner.fail('Client registration failed');
    callbackServer.close();
    outputError(
      {
        message: errorMessage(err, 'Failed to register OAuth client'),
        code: 'oauth_registration_error',
      },
      { json: globalOpts.json },
    );
    return;
  }

  const authUrl = new URL(`${baseUrl}/oauth/authorize`);
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: callbackServer.redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }).toString();

  const opened = await openInBrowser(authUrl.toString());
  if (opened) {
    p.log.info(`Opened browser for authorization. Waiting for callback...`);
  } else {
    p.log.warn(
      `Could not open browser. Visit this URL to authorize:\n${authUrl.toString()}`,
    );
  }

  let callbackCode: string;
  let callbackState: string;
  try {
    const result = await callbackServer.waitForCallback();
    callbackCode = result.code;
    callbackState = result.state;
  } catch (err) {
    callbackServer.close();
    outputError(
      {
        message: errorMessage(err, 'OAuth authorization failed'),
        code: 'oauth_callback_error',
      },
      { json: globalOpts.json },
    );
    return;
  }

  if (callbackState !== state) {
    outputError(
      {
        message:
          'OAuth state mismatch — possible CSRF attempt. Authorization aborted.',
        code: 'oauth_state_mismatch',
      },
      { json: globalOpts.json },
    );
    return;
  }

  const exchangeSpinner = createSpinner('Exchanging authorization code...', globalOpts.quiet);
  let accessToken: string;
  let refreshToken: string;
  let grantedScope: string;
  try {
    const tokens = await exchangeCode({
      baseUrl,
      clientId,
      code: callbackCode,
      redirectUri: callbackServer.redirectUri,
      codeVerifier,
    });
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    grantedScope = tokens.scope;
    exchangeSpinner.stop('Tokens received');
  } catch (err) {
    exchangeSpinner.fail('Token exchange failed');
    outputError(
      {
        message: errorMessage(err, 'Failed to exchange authorization code'),
        code: 'oauth_token_error',
      },
      { json: globalOpts.json },
    );
    return;
  }

  // Suppress unused variable warning — accessToken is only needed to confirm success
  void accessToken;

  let profileName = globalOpts.profile?.trim() || undefined;

  if (profileName) {
    const profileError = validateProfileName(profileName);
    if (profileError) {
      outputError(
        { message: profileError, code: 'invalid_profile_name' },
        { json: globalOpts.json },
      );
      return;
    }
  }

  if (!profileName) {
    const existingProfiles = listProfiles();
    if (existingProfiles.length > 0) {
      const options = [
        ...existingProfiles.map((t) => ({
          value: t.name,
          label: `${t.name} (overwrite)`,
        })),
        { value: '__new__' as const, label: '+ Create new profile' },
      ];

      const choice = await p.select({
        message: 'Save OAuth credentials to which profile?',
        options,
      });

      if (p.isCancel(choice)) {
        cancelAndExit('Login cancelled.');
        return;
      }

      if (choice === '__new__') {
        const newName = await p.text({
          message: 'Enter a name for the new profile:',
          placeholder: 'staging',
          validate: (v) => validateProfileName((v ?? '').trim()),
        });
        if (p.isCancel(newName)) {
          cancelAndExit('Login cancelled.');
          return;
        }
        profileName = (newName ?? '').trim() || 'staging';
      } else {
        profileName = choice;
      }
    } else {
      profileName = 'staging';
    }
  }

  const storeSpinner = createSpinner('Storing credentials...', globalOpts.quiet);
  let configPath: string;
  let backend: Awaited<ReturnType<typeof storeOAuthProfile>>['backend'];
  try {
    ({ configPath, backend } = await storeOAuthProfile(profileName, {
      clientId,
      refreshToken,
      scope: grantedScope,
      baseUrl,
    }));
    storeSpinner.stop('Credentials stored');
  } catch (err) {
    storeSpinner.fail('Failed to store credentials');
    outputError(
      {
        message: errorMessage(err, 'Failed to store OAuth credentials'),
        code: 'write_failed',
      },
      { json: globalOpts.json },
    );
    return;
  }

  try {
    setActiveProfile(profileName);
  } catch {
    // non-fatal
  }

  if (globalOpts.json) {
    outputResult(
      {
        success: true,
        config_path: configPath,
        profile: profileName,
        storage: backend.name,
        auth_type: 'oauth',
        client_id: clientId,
        scope: grantedScope,
        base_url: baseUrl,
      },
      { json: true },
    );
  } else {
    const storageInfo = !backend.isSecure
      ? `at ${configPath}`
      : `in ${backend.name}`;
    p.outro(
      `OAuth credentials stored for profile '${profileName}' ${storageInfo}\nClient ID: ${clientId}  Scope: ${grantedScope}`,
    );
  }
}

export const loginCommand = new Command('login')
  .description('Save a Resend API key')
  .option('--key <key>', 'API key to store (required in non-interactive mode)')
  .option('--oauth', 'Authenticate via OAuth 2.1 browser flow (staging only)')
  .option(
    '--base-url <url>',
    'OAuth authorization server base URL',
    OAUTH_DEFAULT_BASE_URL,
  )
  .option('--scope <scope>', 'OAuth scope to request', OAUTH_DEFAULT_SCOPE)
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
      ],
      examples: [
        'resend login --key re_123456789',
        'resend login                      (interactive — prompts and opens browser)',
        'resend login --oauth              (OAuth browser flow against staging)',
        'RESEND_API_KEY=re_123 resend emails send ...  (skip login; use env var directly)',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (opts.oauth) {
      await handleOAuthLogin(
        globalOpts,
        opts.baseUrl ?? OAUTH_DEFAULT_BASE_URL,
        opts.scope ?? OAUTH_DEFAULT_SCOPE,
      );
      return;
    }

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
      p.log.info(
        `Use a full access API key for complete CLI access.\n${SENDING_KEY_MESSAGE}`,
      );

      const method = await p.select({
        message: 'How would you like to get your API key?',
        options: [
          {
            value: 'browser' as const,
            label: 'Open resend.com/api-keys in browser',
          },
          { value: 'manual' as const, label: 'Enter API key manually' },
        ],
      });

      if (p.isCancel(method)) {
        cancelAndExit('Login cancelled.');
      }

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
          return;
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

    let profileName = globalOpts.profile?.trim() || undefined;

    if (profileName) {
      const profileError = validateProfileName(profileName);
      if (profileError) {
        outputError(
          { message: profileError, code: 'invalid_profile_name' },
          { json: globalOpts.json },
        );
        return;
      }
    }

    if (!profileName && isInteractive() && !globalOpts.json) {
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

        const choice = await p.select({
          message: 'Save API key to which profile?',
          options,
        });

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
            return;
          }
          profileName = renamed;
        } else {
          profileName = choice;
        }
      } else {
        profileName = 'default';
      }
    }

    const { configPath, backend } = await storeApiKeyAsync(
      apiKey,
      profileName,
      detectedPermission,
    );
    const profileLabel = profileName || 'default';

    // Auto-switch to the newly added profile (only when user specified a profile)
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
