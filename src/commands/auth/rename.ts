import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import {
  listProfiles,
  renameProfileAsync,
  validateProfileName,
} from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export async function renameAction(
  oldName: string | undefined,
  newName: string | undefined,
  globalOpts: GlobalOpts,
) {
  let from = oldName;
  let to = newName;

  if (!from) {
    if (!isInteractive() || globalOpts.json) {
      outputError(
        {
          message:
            'Missing profile name. Provide old and new names in non-interactive mode.',
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
      message: 'Rename which profile?',
      options: profiles.map((t) => ({
        value: t.name,
        label: t.name,
        hint: t.active
          ? 'active'
          : validateProfileName(t.name)
            ? 'invalid name'
            : undefined,
      })),
    });

    if (p.isCancel(choice)) {
      cancelAndExit('Rename cancelled.');
    }

    from = choice;
  }

  if (!to) {
    if (!isInteractive() || globalOpts.json) {
      outputError(
        {
          message:
            'Missing new name. Provide old and new names in non-interactive mode.',
          code: 'missing_name',
        },
        { json: globalOpts.json },
      );
      return;
    }

    const result = await p.text({
      message: `Enter new name for '${from}':`,
      placeholder: from.replace(/[^a-zA-Z0-9._-]/g, '-'),
      validate: (v) => validateProfileName(v as string),
    });

    if (p.isCancel(result)) {
      cancelAndExit('Rename cancelled.');
    }

    to = result;
  }

  try {
    await renameProfileAsync(from, to);
  } catch (err) {
    outputError(
      {
        message: errorMessage(err, 'Failed to rename profile'),
        code: 'rename_failed',
      },
      { json: globalOpts.json },
    );
    return;
  }

  if (globalOpts.json) {
    outputResult(
      { success: true, old_name: from, new_name: to },
      { json: true },
    );
  } else {
    console.log(`Profile '${from}' renamed to '${to}'.`);
  }
}

export const renameCommand = new Command('rename')
  .description('Rename a profile')
  .argument('[old-name]', 'Current profile name')
  .argument('[new-name]', 'New profile name')
  .action(async (oldName, newName, _opts, cmd) => {
    await renameAction(oldName, newName, cmd.optsWithGlobals() as GlobalOpts);
  });
