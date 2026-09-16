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
        'resend inboxes threads emails get --inbox-id <inboxId> --thread-id <threadId> --email-id <emailId>',
        'resend inboxes threads emails reply --inbox-id <inboxId> --thread-id <threadId> --email-id <emailId> --text "Thanks!"',
        'resend inboxes threads emails forward --inbox-id <inboxId> --thread-id <threadId> --email-id <emailId> --to teammate@example.com',
      ],
    }),
  )
  .addCommand(getInboxThreadEmailCommand)
  .addCommand(replyInboxThreadEmailCommand)
  .addCommand(forwardInboxThreadEmailCommand);
