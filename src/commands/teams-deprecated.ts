import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import { listAction } from './auth/list';
import { removeAction } from './auth/remove';
import { switchAction } from './auth/switch';

function warnDeprecated(globalOpts: GlobalOpts) {
  if (globalOpts.json || globalOpts.quiet) {
    return;
  }
  process.stderr.write(
    'Warning: "resend teams" is deprecated. Use "resend auth" instead.\n',
  );
}

const deprecatedListCommand = new Command('list')
  .description('List all profiles')
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    warnDeprecated(globalOpts);
    listAction(globalOpts);
  });

const deprecatedSwitchCommand = new Command('switch')
  .description('Switch the active profile')
  .argument('[name]', 'Profile name to switch to')
  .action(async (name, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    warnDeprecated(globalOpts);
    await switchAction(name, globalOpts);
  });

const deprecatedRemoveCommand = new Command('remove')
  .description('Remove a profile')
  .argument('[name]', 'Profile name to remove')
  .action(async (name, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    warnDeprecated(globalOpts);
    await removeAction(name, globalOpts);
  });

export const teamsDeprecatedCommand = new Command('teams')
  .description('(deprecated) Use "resend auth" instead')
  .addCommand(deprecatedListCommand)
  .addCommand(deprecatedSwitchCommand)
  .addCommand(deprecatedRemoveCommand);

// Hide from --help output (Commander's extra-typings doesn't expose .hidden())
(teamsDeprecatedCommand as unknown as { _hidden: boolean })._hidden = true;
