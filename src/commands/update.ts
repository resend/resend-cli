import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import { buildHelpText } from '../lib/help-text';
import { outputError, outputResult } from '../lib/output';
import { createSpinner } from '../lib/spinner';
import { isInteractive } from '../lib/tty';
import {
  detectInstallMethod,
  fetchLatestVersion,
  isNewer,
} from '../lib/update-check';
import { VERSION } from '../lib/version';

export const updateCommand = new Command('update')
  .description('Check for available CLI updates')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Checks the latest release on GitHub (bypasses the cache).
Shows the current version, latest version, and how to upgrade.`,
      output: `  {"current":"1.4.0","latest":"1.5.0","update_available":true,"upgrade_command":"npm install -g resend-cli"}
  {"current":"1.5.0","latest":"1.5.0","update_available":false}`,
      examples: ['resend update', 'resend update --json'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const interactive = isInteractive() && !globalOpts.json;

    const spinner = interactive
      ? createSpinner('Checking for updates...')
      : null;

    const latest = await fetchLatestVersion();

    if (!latest) {
      spinner?.fail('Could not check for updates');
      outputError(
        { message: 'Could not reach GitHub releases', code: 'fetch_failed' },
        { json: globalOpts.json },
      );
      return;
    }

    const updateAvailable = isNewer(VERSION, latest);
    const upgrade = detectInstallMethod();

    if (globalOpts.json || !isInteractive()) {
      outputResult(
        {
          current: VERSION,
          latest,
          update_available: updateAvailable,
          ...(updateAvailable ? { upgrade_command: upgrade } : {}),
        },
        { json: globalOpts.json },
      );
      return;
    }

    if (updateAvailable) {
      const isUrl = upgrade.startsWith('http');
      spinner?.warn(`Update available: v${VERSION} → v${latest}`);
      console.log(
        `\n  ${isUrl ? 'Visit' : 'Run'}: \x1B[36m${upgrade}\x1B[0m\n`,
      );
    } else {
      spinner?.stop(`Already up to date (v${VERSION})`);
    }
  });
