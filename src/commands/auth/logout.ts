import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { getConfigDir, removeApiKey } from '../../lib/config';
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

If no credentials file exists, exits cleanly with no error.`,
      output: `  {"success":true,"config_path":"<path>"}`,
      errorCodes: ['remove_failed'],
      examples: ['resend logout', 'resend logout --json'],
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

    if (!globalOpts.json && isInteractive()) {
      const confirmed = await p.confirm({
        message: `Remove saved API key at ${configPath}?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        cancelAndExit('Logout cancelled.');
      }
    }

    try {
      removeApiKey();
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to remove credentials file'),
          code: 'remove_failed',
        },
        { json: globalOpts.json },
      );
    }

    if (!globalOpts.json && isInteractive()) {
      p.outro('Logged out. API key removed.');
    } else {
      outputResult(
        { success: true, config_path: configPath },
        { json: globalOpts.json },
      );
    }
  });
