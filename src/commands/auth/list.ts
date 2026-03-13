import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listProfiles } from '../../lib/config';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export function listAction(globalOpts: GlobalOpts) {
  const profiles = listProfiles();

  if (globalOpts.json) {
    outputResult({ profiles }, { json: true });
    return;
  }

  if (profiles.length === 0) {
    console.log('No profiles configured. Run: resend login');
    return;
  }

  if (isInteractive()) {
    console.log('\n  Profiles\n');
  }

  for (const profile of profiles) {
    const marker = profile.active ? ' (active)' : '';
    console.log(`  ${profile.active ? '▸' : ' '} ${profile.name}${marker}`);
  }

  if (isInteractive()) {
    console.log('');
  }
}

export const listCommand = new Command('list')
  .description('List all profiles')
  .action((_opts, cmd) => {
    listAction(cmd.optsWithGlobals() as GlobalOpts);
  });
