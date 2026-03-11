import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listTeams, removeApiKey } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const removeCommand = new Command('remove')
  .description('Remove a team profile')
  .argument('[name]', 'Team name to remove')
  .action(async (name, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    let teamName = name;

    if (!teamName) {
      if (!isInteractive()) {
        outputError(
          {
            message:
              'Missing team name. Provide a team name in non-interactive mode.',
            code: 'missing_name',
          },
          { json: globalOpts.json },
        );
        return;
      }

      const teams = listTeams();
      if (teams.length === 0) {
        outputError(
          {
            message: 'No teams configured. Run `resend login` first.',
            code: 'no_teams',
          },
          { json: globalOpts.json },
        );
        return;
      }

      const choice = await p.select({
        message: 'Remove which team?',
        options: teams.map((t) => ({
          value: t.name,
          label: t.name,
          hint: t.active ? 'active' : undefined,
        })),
      });

      if (p.isCancel(choice)) {
        cancelAndExit('Remove cancelled.');
      }

      teamName = choice;
    }

    if (!globalOpts.json && isInteractive()) {
      const confirmed = await p.confirm({
        message: `Remove team '${teamName}' and its API key?`,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        cancelAndExit('Remove cancelled.');
      }
    }

    try {
      removeApiKey(teamName);
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to remove team'),
          code: 'remove_failed',
        },
        { json: globalOpts.json },
      );
      return;
    }

    if (globalOpts.json) {
      outputResult({ success: true, removed_team: teamName }, { json: true });
    } else if (isInteractive()) {
      console.log(`Team '${teamName}' removed.`);
    }
  });
