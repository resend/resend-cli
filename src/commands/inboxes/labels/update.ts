import { Command, Option } from '@commander-js/extra-typings';
import { INBOX_LABEL_COLORS } from 'resend';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxLabelPickerConfig } from './utils';

export const updateInboxLabelCommand = new Command('update')
  .description("Update a label's name or color")
  .option('--inbox-id <id>', 'Inbox UUID')
  .option('--label-id <id>', 'Label UUID')
  .option('--name <name>', 'New label name (max 64 characters)')
  .addOption(
    new Option('--color <color>', 'New label color').choices(
      INBOX_LABEL_COLORS,
    ),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: 'At least one of --name or --color must be provided.',
      output: `  {"object":"inbox_label","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend inboxes labels update --inbox-id <inboxId> --label-id <labelId> --name "Billing"',
        'resend inboxes labels update --inbox-id <inboxId> --label-id <labelId> --color teal --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (!opts.name && !opts.color) {
      outputError(
        {
          message: 'Provide at least one option to update: --name or --color.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);
    const labelId = await pickId(
      opts.labelId,
      inboxLabelPickerConfig(inboxId),
      globalOpts,
    );

    await runWrite(
      {
        loading: 'Updating label...',
        sdkCall: (resend) =>
          resend.inboxes.labels.update({
            inboxId,
            labelId,
            ...(opts.name && { name: opts.name }),
            ...(opts.color && { color: opts.color }),
          }),
        errorCode: 'update_error',
        successMsg: `Label updated: ${labelId}`,
      },
      globalOpts,
    );
  });
