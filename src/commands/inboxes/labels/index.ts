import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { createInboxLabelCommand } from './create';
import { deleteInboxLabelCommand } from './delete';
import { listInboxLabelsCommand } from './list';
import { updateInboxLabelCommand } from './update';

export const inboxLabelsCommand = new Command('labels')
  .description('Manage labels for organizing threads in an inbox')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Labels organize threads within an inbox. Apply one with
"resend inboxes threads update <inboxId> <threadId> --label-id <labelId>" and
filter with "resend inboxes threads list <inboxId> --label <labelId>".`,
      examples: [
        'resend inboxes labels list <inboxId>',
        'resend inboxes labels create <inboxId> --name "Billing" --color teal',
        'resend inboxes labels delete <inboxId> <labelId> --yes',
      ],
    }),
  )
  .addCommand(listInboxLabelsCommand, { isDefault: true })
  .addCommand(createInboxLabelCommand)
  .addCommand(updateInboxLabelCommand)
  .addCommand(deleteInboxLabelCommand);
