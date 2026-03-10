import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listTeams, setActiveTeam } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const switchCommand = new Command('switch')
  .description('Switch the active team profile')
  .argument('[name]', 'Team name to switch to')
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
      }

      const choice = await p.select({
        message: 'Switch to which team?',
        options: teams.map((t) => ({
          value: t.name,
          label: t.name,
          hint: t.active ? 'active' : undefined,
        })),
      });

      if (p.isCancel(choice)) {
        cancelAndExit('Switch cancelled.');
      }

      teamName = choice;
    }

    try {
      setActiveTeam(teamName);
    } catch (err) {
      outputError(
        {
          message: errorMessage(err, 'Failed to switch team'),
          code: 'switch_failed',
        },
        { json: globalOpts.json },
      );
    }

    if (globalOpts.json) {
      outputResult({ success: true, active_team: teamName }, { json: true });
    } else if (isInteractive()) {
      console.log(`Switched to team '${teamName}'.`);
    }
  });
