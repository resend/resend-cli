import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../../lib/help-text';
import { addInboxThreadLabelsCommand } from './add';
import { removeInboxThreadLabelCommand } from './remove';
import { setInboxThreadLabelsCommand } from './set';

export const inboxThreadLabelsCommand = new Command('labels')
  .description('Add, replace, or remove the labels on a thread')
  .addHelpText(
    'after',
    buildHelpText({
      context: `"add" adds labels and keeps the others, "set" replaces every label, and
"remove" removes one label. Each command outputs every label on the thread
after the change. To read the labels of a thread, use "resend inboxes threads get".
Label IDs come from "resend inboxes labels list".`,
      examples: [
        'resend inboxes threads labels add <inbox-id> <thread-id> --labels <label-id>',
        'resend inboxes threads labels set <inbox-id> <thread-id> --labels <label-id> <other-label-id>',
        'resend inboxes threads labels remove <inbox-id> <thread-id> <label-id>',
      ],
    }),
  )
  .addCommand(addInboxThreadLabelsCommand)
  .addCommand(setInboxThreadLabelsCommand)
  .addCommand(removeInboxThreadLabelCommand);
