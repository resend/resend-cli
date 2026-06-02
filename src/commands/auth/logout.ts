import { existsSync } from 'node:fs';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import {
  getCredentialsPath,
  isOAuthProfile,
  removeAllApiKeysAsync,
  removeApiKeyAsync,
  tryReadCredentials,
} from '../../lib/config';
import {
  getCredentialBackend,
  SERVICE_NAME,
} from '../../lib/credential-store';
import { revokeToken } from '../../lib/oauth';
import { buildHelpText } from '../../lib/help-text';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const logoutCommand = new Command('logout')
  .description('Remove your saved Resend API key')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Removes the saved API key from secure storage and the credentials file.

When --profile is specified, only that profile's entry is removed.
When no profile is specified, all profiles are removed.

If no credentials file exists, exits cleanly with no error.`,
      output: `  {"success":true,"config_path":"<path>"}`,
      errorCodes: ['remove_failed'],
      examples: [
        'resend logout',
        'resend logout --profile staging',
        'resend logout --json',
      ],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const configPath = getCredentialsPath();

    const creds = tryReadCredentials();

    if (!creds && !existsSync(configPath)) {
      if (!globalOpts.json && isInteractive()) {
        console.log('No saved credentials found. Nothing to remove.');
      } else {
        outputResult(
          { success: true, already_logged_out: true },
          { json: globalOpts.json },
        );
      }
      return;
    }

    const profileFlag = globalOpts.profile;
    const logoutAll = !profileFlag;
    // For logoutAll we don't need a specific profile; for single-profile
    // removal, the user-supplied flag is the source of truth. We deliberately
    // avoid resolveProfileName() so a corrupted credentials file doesn't
    // crash the "logout all" path.
    const profileLabel = profileFlag ?? 'all';

    // Only validate profile existence when we can actually read the file.
    // If creds is null because the file is corrupted, fall through and let
    // removeApiKeyAsync surface the corruption error to the user.
    if (!logoutAll && creds && !creds.profiles[profileLabel]) {
      outputError(
        {
          message: `Profile "${profileLabel}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
          code: 'remove_failed',
        },
        { json: globalOpts.json },
      );
    }

    if (!globalOpts.json && isInteractive()) {
      const message = logoutAll
        ? 'Remove all saved API keys?'
        : `Remove saved API key for profile '${profileLabel}'?`;

      const confirmed = await p.confirm({ message });

      if (p.isCancel(confirmed) || !confirmed) {
        cancelAndExit('Logout cancelled.');
      }
    }

    // Best-effort revocation for OAuth profiles before removing credentials
    if (creds) {
      try {
        const backend = await getCredentialBackend();
        if (logoutAll) {
          for (const [name, profile] of Object.entries(creds.profiles)) {
            if (!isOAuthProfile(profile)) continue;
            const refreshToken = creds.storage === 'secure_storage'
              ? await backend.get(SERVICE_NAME, name)
              : profile.refresh_token;
            if (refreshToken) {
              await revokeToken({ baseUrl: profile.base_url, clientId: profile.client_id, token: refreshToken });
            }
          }
        } else {
          const profile = creds.profiles[profileLabel];
          if (profile && isOAuthProfile(profile)) {
            const refreshToken = creds.storage === 'secure_storage'
              ? await backend.get(SERVICE_NAME, profileLabel)
              : profile.refresh_token;
            if (refreshToken) {
              await revokeToken({ baseUrl: profile.base_url, clientId: profile.client_id, token: refreshToken });
            }
          }
        }
      } catch {
        // revocation is best-effort
      }
    }

    try {
      if (logoutAll) {
        await removeAllApiKeysAsync();
      } else {
        await removeApiKeyAsync(profileLabel);
      }
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to remove credentials'),
          code: 'remove_failed',
        },
        { json: globalOpts.json },
      );
    }

    if (!globalOpts.json && isInteractive()) {
      const msg = logoutAll
        ? 'Logged out. All API keys removed.'
        : `Logged out. API key removed for profile '${profileLabel}'.`;
      p.outro(msg);
    } else {
      outputResult(
        {
          success: true,
          config_path: configPath,
          profile: logoutAll ? 'all' : profileLabel,
        },
        { json: globalOpts.json },
      );
    }
  });
