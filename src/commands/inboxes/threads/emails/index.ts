import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../../lib/help-text';
import { forwardInboxThreadEmailCommand } from './forward';
import { getInboxThreadEmailCommand } from './get';
import { listInboxThreadEmailsCommand } from './list';
import { replyInboxThreadEmailCommand } from './reply';

export const inboxThreadEmailsCommand = new Command('emails')
  .description('Work with individual emails in a thread')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Email IDs come from "resend inboxes threads emails list", which lists the messages in a thread.',
      examples: [
        'resend inboxes threads emails list <inbox-id> <thread-id>',
        'resend inboxes threads emails get <inbox-id> <thread-id> <email-id>',
        'resend inboxes threads emails reply <inbox-id> <thread-id> <email-id> --text "Thanks!"',
        'resend inboxes threads emails forward <inbox-id> <thread-id> <email-id> --to teammate@example.com',
      ],
    }),
  )
  .addCommand(listInboxThreadEmailsCommand, { isDefault: true })
  .addCommand(getInboxThreadEmailCommand)
  .addCommand(replyInboxThreadEmailCommand)
  .addCommand(forwardInboxThreadEmailCommand);
