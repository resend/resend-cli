import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { listProfiles, removeApiKey } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export async function removeAction(
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
      message: 'Remove which profile?',
      options: profiles.map((t) => ({
        value: t.name,
        label: t.name,
        hint: t.active ? 'active' : undefined,
      })),
    });

    if (p.isCancel(choice)) {
      cancelAndExit('Remove cancelled.');
    }

    profileName = choice;
  }

  if (!globalOpts.json && isInteractive()) {
    const confirmed = await p.confirm({
      message: `Remove profile '${profileName}' and its API key?`,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      cancelAndExit('Remove cancelled.');
    }
  }

  try {
    removeApiKey(profileName);
  } catch (err) {
    outputError(
      {
        message: errorMessage(err, 'Failed to remove profile'),
        code: 'remove_failed',
      },
      { json: globalOpts.json },
    );
    return;
  }

  if (globalOpts.json) {
    outputResult(
      { success: true, removed_profile: profileName },
      { json: true },
    );
  } else if (isInteractive()) {
    console.log(`Profile '${profileName}' removed.`);
  }
}

export const removeCommand = new Command('remove')
  .description('Remove a profile')
  .argument('[name]', 'Profile name to remove')
  .action(async (name, _opts, cmd) => {
    await removeAction(name, cmd.optsWithGlobals() as GlobalOpts);
  });
