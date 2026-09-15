import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../../lib/help-text';
import { replyInboxThreadEmailCommand } from './reply';

export const inboxThreadEmailsCommand = new Command('emails')
  .description('Work with individual emails in a thread')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Email IDs come from "resend inboxes threads get", which lists every message in a thread.',
      examples: [
        'resend inboxes threads emails reply <inboxId> <threadId> <emailId> --text "Thanks!"',
      ],
    }),
  )
  .addCommand(replyInboxThreadEmailCommand);
