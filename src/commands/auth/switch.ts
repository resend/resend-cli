import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listProfiles, setActiveProfile } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export async function switchAction(
  name: string | undefined,
  globalOpts: GlobalOpts,
) {
  let profileName = name;

  if (!profileName) {
    if (!isInteractive()) {
      outputError(
        {
          message:
            'Missing profile name. Provide a profile name in non-interactive mode.',
          code: 'missing_name',
        },
        { json: globalOpts.json },
      );
      return;
    }

    const profiles = listProfiles();
    if (profiles.length === 0) {
      outputError(
        {
          message: 'No profiles configured. Run `resend login` first.',
          code: 'no_profiles',
        },
        { json: globalOpts.json },
      );
      return;
    }

    const choice = await p.select({
      message: 'Switch to which profile?',
      options: profiles.map((t) => ({
        value: t.name,
        label: t.name,
        hint: t.active ? 'active' : undefined,
      })),
    });

    if (p.isCancel(choice)) {
      cancelAndExit('Switch cancelled.');
    }

    profileName = choice;
  }

  try {
    setActiveProfile(profileName);
  } catch (err) {
    outputError(
      {
        message: errorMessage(err, 'Failed to switch profile'),
        code: 'switch_failed',
      },
      { json: globalOpts.json },
    );
    return;
  }

  if (globalOpts.json) {
    outputResult(
      { success: true, active_profile: profileName },
      { json: true },
    );
  } else {
    console.log(`Switched to profile '${profileName}'.`);
  }
}

export const switchCommand = new Command('switch')
  .description('Switch the active profile')
  .argument('[name]', 'Profile name to switch to')
  .action(async (name, _opts, cmd) => {
    await switchAction(name, cmd.optsWithGlobals() as GlobalOpts);
  });
