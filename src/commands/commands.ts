import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import { collectCommandTree } from '../lib/completion';
import { buildHelpText } from '../lib/help-text';
import { outputResult } from '../lib/output';

export const listCommandsCommand = new Command('commands')
  .description('Print the full command tree as JSON (for agents and tooling)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Outputs every subcommand, option, and description from the CLI definition.
In machine mode (piped, CI, or --json), the tree is JSON you can feed to agents or scripts.`,
      examples: [
        'resend commands',
        'resend commands --json',
        'resend commands | jq ".subcommands[].name"',
      ],
    }),
  )
  .action((_opts, cmd) => {
    const root = cmd.parent;
    if (!root) {
      throw new Error('commands must be registered on the root program');
    }
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const tree = collectCommandTree(root as Command);
    outputResult(tree, { json: globalOpts.json });
  });
