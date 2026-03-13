import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listProfiles, validateProfileName } from '../../lib/config';
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

  let hasInvalid = false;
  for (const profile of profiles) {
    const marker = profile.active ? ' (active)' : '';
    const isInvalid = validateProfileName(profile.name) !== undefined;
    if (isInvalid) {
      hasInvalid = true;
    }
    console.log(
      `  ${profile.active ? '▸' : ' '} ${profile.name}${marker}${isInvalid ? ' (invalid name)' : ''}`,
    );
  }

  if (hasInvalid) {
    console.log(
      '\n  Profiles with invalid names can be renamed via `resend auth rename`.',
    );
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
