import { Command } from '@commander-js/extra-typings';
import type { UpdateInboxOptions } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId } from '../../lib/prompts';
import { inboxPickerConfig } from './utils';

export const updateInboxCommand = new Command('update')
  .description("Update an inbox's name or friendly name")
  .argument('[id]', 'Inbox UUID')
  .option('--name <name>', 'New inbox name')
  .option(
    '--friendly_name <name>',
    'New name used when sending from this inbox, e.g. "Ada from Support"',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --name or --friendly_name is required.

Note: the email address cannot be changed after creation.
To use a different address, create a new inbox.`,
      output: `  {"object":"inbox","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Support"',
        'resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --friendly_name "Ada from Support" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, inboxPickerConfig, globalOpts);

    if (!opts.name && !opts.friendly_name) {
      outputError(
        {
          message:
            'Provide at least one option to update: --name or --friendly_name.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    // The SDK requires at least one change at the type level, which the
    // no_changes guard above guarantees but tsc cannot prove across the
    // conditional spreads.
    const payload = {
      ...(opts.name && { name: opts.name }),
      ...(opts.friendly_name && { friendlyName: opts.friendly_name }),
    } as UpdateInboxOptions;

    await runWrite(
      {
        loading: 'Updating inbox...',
        sdkCall: (resend) => resend.inboxes.update(id, payload),
        errorCode: 'update_error',
        successMsg: `Inbox updated: ${id}`,
      },
      globalOpts,
    );
  });
