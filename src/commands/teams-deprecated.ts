import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import {
  listProfiles,
  removeApiKey,
  setActiveProfile,
} from '../lib/config';
import { errorMessage, outputError, outputResult } from '../lib/output';
import { cancelAndExit } from '../lib/prompts';
import { isInteractive } from '../lib/tty';

function warnDeprecated() {
  process.stderr.write(
    'Warning: "resend teams" is deprecated. Use "resend auth" instead.\n',
  );
}

const deprecatedListCommand = new Command('list')
  .description('List all profiles')
  .action((_opts, cmd) => {
    warnDeprecated();
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
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
      console.log(
        `  ${profile.active ? '▸' : ' '} ${profile.name}${marker}`,
      );
    }

    if (isInteractive()) {
      console.log('');
    }
  });

const deprecatedSwitchCommand = new Command('switch')
  .description('Switch the active profile')
  .argument('[name]', 'Profile name to switch to')
  .action(async (name, _opts, cmd) => {
    warnDeprecated();
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

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
    } else if (isInteractive()) {
      console.log(`Switched to profile '${profileName}'.`);
    }
  });

const deprecatedRemoveCommand = new Command('remove')
  .description('Remove a profile')
  .argument('[name]', 'Profile name to remove')
  .action(async (name, _opts, cmd) => {
    warnDeprecated();
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

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
  });

export const teamsDeprecatedCommand = new Command('teams')
  .description('(deprecated) Use "resend auth" instead')
  .addCommand(deprecatedListCommand)
  .addCommand(deprecatedSwitchCommand)
  .addCommand(deprecatedRemoveCommand);

// Hide from --help output (Commander's extra-typings doesn't expose .hidden())
(teamsDeprecatedCommand as unknown as { _hidden: boolean })._hidden = true;
