import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import { maskKey, resolveApiKey, resolveTeamName } from '../lib/config';
import { buildHelpText } from '../lib/help-text';
import { outputError, outputResult } from '../lib/output';
import { isInteractive } from '../lib/tty';

export const whoamiCommand = new Command('whoami')
  .description('Show current authentication status')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Local only — no network calls.
Shows which team is active and where the API key comes from.`,
      output: `  {"authenticated":true,"team":"production","api_key":"re_...abcd","source":"config"}
  {"authenticated":false}`,
      examples: [
        'resend whoami',
        'resend whoami --json',
        'resend whoami --team production',
      ],
    }),
  )
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const teamName = globalOpts.team;
    const resolved = resolveApiKey(globalOpts.apiKey, teamName);

    if (!resolved) {
      if (globalOpts.json || !isInteractive()) {
        outputResult(
          { authenticated: false },
          { json: globalOpts.json, exitCode: 1 },
        );
        // outputResult with exitCode calls process.exit, but TS doesn't know
        return;
      }
      outputError(
        {
          message: 'Not authenticated.\nRun `resend login` to get started.',
          code: 'not_authenticated',
        },
        { json: false },
      );
      return;
    }

    const team = resolved.team ?? resolveTeamName(teamName);

    if (globalOpts.json || !isInteractive()) {
      outputResult(
        {
          authenticated: true,
          team,
          api_key: maskKey(resolved.key),
          source: resolved.source,
        },
        { json: globalOpts.json },
      );
      return;
    }

    console.log('');
    console.log(`  Team:    ${team}`);
    console.log(`  API Key: ${maskKey(resolved.key)}`);
    console.log(
      `  Source:  ${resolved.source === 'config' ? 'config file' : resolved.source === 'env' ? 'environment variable' : 'flag'}`,
    );
    console.log('');
  });
