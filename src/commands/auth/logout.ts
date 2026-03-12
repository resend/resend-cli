import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import {
  getConfigDir,
  removeAllApiKeys,
  removeApiKey,
  resolveProfileName,
} from '../../lib/config';
import { buildHelpText } from '../../lib/help-text';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const logoutCommand = new Command('logout')
  .description(
    'Remove the saved Resend API key from the local credentials file',
  )
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Removes the saved API key from ~/.config/resend/credentials.json.
  (Linux: $XDG_CONFIG_HOME/resend/credentials.json)
  (Windows: %APPDATA%\\resend\\credentials.json)

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

    const configPath = join(getConfigDir(), 'credentials.json');

    if (!existsSync(configPath)) {
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

    const profileFlag = globalOpts.profile ?? globalOpts.team;
    const logoutAll = !profileFlag;
    const profileLabel = profileFlag || resolveProfileName();

    if (!globalOpts.json && isInteractive()) {
      const message = logoutAll
        ? `Remove all saved API keys at ${configPath}?`
        : `Remove saved API key for profile '${profileLabel}'?`;

      const confirmed = await p.confirm({ message });

      if (p.isCancel(confirmed) || !confirmed) {
        cancelAndExit('Logout cancelled.');
      }
    }

    try {
      if (logoutAll) {
        removeAllApiKeys();
      } else {
        removeApiKey(profileLabel);
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
