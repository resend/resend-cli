import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../../lib/help-text';
import { forwardInboxThreadEmailCommand } from './forward';
import { getInboxThreadEmailCommand } from './get';
import { replyInboxThreadEmailCommand } from './reply';

export const inboxThreadEmailsCommand = new Command('emails')
  .description('Work with individual emails in a thread')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Email IDs come from "resend inboxes threads get", which lists every message in a thread.',
      examples: [
        'resend inboxes threads emails get --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id>',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Thanks!"',
        'resend inboxes threads emails forward --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --to teammate@example.com',
      ],
    }),
  )
  .addCommand(getInboxThreadEmailCommand)
  .addCommand(replyInboxThreadEmailCommand)
  .addCommand(forwardInboxThreadEmailCommand);
