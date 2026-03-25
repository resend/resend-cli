import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
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
        'resend emails send --from onboarding@resend.com --to delivered@resend.com --subject "Hello" --text "Hi"',
        'resend emails get <email-id>',
        'resend emails batch --file ./emails.json',
        'resend emails cancel <email-id>',
        'resend emails receiving list',
        'resend emails receiving forward <email-id> --to delivered@resend.com --from onboarding@resend.com',
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
