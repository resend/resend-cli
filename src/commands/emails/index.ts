import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/formatters';
import { batchCommand } from './batch';
import { cancelCommand } from './cancel';
import { getEmailCommand } from './get';
import { listEmailsCommand } from './list';
import { receivingCommand } from './receiving/index';
import { sendCommand } from './send';
import { updateCommand } from './update';

export const emailsCommand = new Command('emails')
  .description('Send and manage emails')
  .addHelpText(
    'after',
    buildHelpText({
      examples: [
        'resend emails list',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hello" --text "Hi"',
        'resend emails get <email-id>',
        'resend emails batch --file ./emails.json',
        'resend emails cancel <email-id>',
        'resend emails update <email-id> --scheduled-at 2024-08-05T11:52:01.858Z',
        'resend emails receiving list',
        'resend emails receiving get <email-id>',
        'resend emails receiving attachments <email-id>',
        'resend emails receiving attachment <email-id> <attachment-id>',
        'resend emails receiving forward <email-id> --to user@example.com --from you@domain.com',
      ],
    }),
  )
  .addCommand(listEmailsCommand, { isDefault: true })
  .addCommand(sendCommand)
  .addCommand(getEmailCommand)
  .addCommand(batchCommand)
  .addCommand(cancelCommand)
  .addCommand(updateCommand)
  .addCommand(receivingCommand);
