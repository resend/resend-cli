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
"resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --label_id <label_id>" and
filter with "resend inboxes threads list --inbox_id <inbox_id> --label <label_id>".`,
      examples: [
        'resend inboxes labels list --inbox_id <inbox_id>',
        'resend inboxes labels create --inbox_id <inbox_id> --name "Billing" --color teal',
        'resend inboxes labels delete --inbox_id <inbox_id> --label_id <label_id> --yes',
      ],
    }),
  )
  .addCommand(listInboxLabelsCommand, { isDefault: true })
  .addCommand(createInboxLabelCommand)
  .addCommand(updateInboxLabelCommand)
  .addCommand(deleteInboxLabelCommand);
