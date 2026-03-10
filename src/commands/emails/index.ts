import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { batchCommand } from './batch';
import { receivingCommand } from './receiving/index';
import { sendCommand } from './send';

export const emailsCommand = new Command('emails')
  .description('Send and manage emails')
  .addHelpText(
    'after',
    buildHelpText({
      examples: [
        'resend emails send --from you@domain.com --to user@example.com --subject "Hello" --text "Hi"',
        'resend emails batch --file ./emails.json',
        'resend emails receiving list',
        'resend emails receiving get <email-id>',
        'resend emails receiving attachments <email-id>',
        'resend emails receiving attachment <email-id> <attachment-id>',
      ],
    }),
  )
  .addCommand(sendCommand)
  .addCommand(batchCommand)
  .addCommand(receivingCommand);
