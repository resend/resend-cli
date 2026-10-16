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
"resend inboxes threads labels add <inbox-id> <thread-id> --labels <label-id>" and
filter with "resend inboxes threads list <inbox-id> --labels <label-id>".`,
      examples: [
        'resend inboxes labels list <inbox-id>',
        'resend inboxes labels create <inbox-id> --name "Billing" --color \'#12A594\'',
        'resend inboxes labels delete <inbox-id> <label-id> --yes',
      ],
    }),
  )
  .addCommand(listInboxLabelsCommand, { isDefault: true })
  .addCommand(createInboxLabelCommand)
  .addCommand(updateInboxLabelCommand)
  .addCommand(deleteInboxLabelCommand);
