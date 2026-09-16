import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId } from '../../lib/prompts';
import { inboxPickerConfig } from './utils';

export const updateInboxCommand = new Command('update')
  .description("Update an inbox's name")
  .argument('[id]', 'Inbox UUID')
  .option('--name <name>', 'New inbox name')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: the email address cannot be changed after creation.
To use a different address, create a new inbox.`,
      output: `  {"object":"inbox","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Support"',
        'resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Support" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, inboxPickerConfig, globalOpts);

    const name = opts.name;
    if (!name) {
      outputError(
        {
          message: 'Provide --name to update the inbox.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    await runWrite(
      {
        loading: 'Updating inbox...',
        sdkCall: (resend) => resend.inboxes.update(id, { name }),
        errorCode: 'update_error',
        successMsg: `Inbox updated: ${id}`,
      },
      globalOpts,
    );
  });
