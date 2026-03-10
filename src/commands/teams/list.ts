import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listTeams } from '../../lib/config';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const listCommand = new Command('list')
  .description('List all team profiles')
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const teams = listTeams();

    if (globalOpts.json) {
      outputResult({ teams }, { json: true });
      return;
    }

    if (teams.length === 0) {
      console.log('No teams configured. Run: resend login');
      return;
    }

    if (isInteractive()) {
      console.log('\n  Teams\n');
    }

    for (const team of teams) {
      const marker = team.active ? ' (active)' : '';
      console.log(`  ${team.active ? '▸' : ' '} ${team.name}${marker}`);
    }

    if (isInteractive()) {
      console.log('');
    }
  });
