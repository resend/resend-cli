import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { emailPickerConfig } from './utils';

export const getEmailCommand = new Command('get')
  .description('Retrieve a sent email by ID')
  .argument('[id]', 'Email ID')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  {"object":"email","id":"<uuid>","from":"onboarding@resend.com","to":["delivered@resend.com"],"subject":"Hello","html":"<p>Hi</p>","text":"Hi","last_event":"delivered","created_at":"<iso-date>","scheduled_at":null,"bcc":null,"cc":null,"reply_to":null}',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend emails get <email-id>',
        'resend emails get <email-id> --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, emailPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching email...',
        sdkCall: (resend) => resend.emails.get(id),
        onInteractive: (data) => {
          console.log(`From:    ${data.from}`);
          console.log(`To:      ${data.to.join(', ')}`);
          console.log(`Subject: ${data.subject}`);
          console.log(`Status:  ${data.last_event}`);
          console.log(`Date:    ${data.created_at}`);
          if (data.scheduled_at) {
            console.log(`Scheduled: ${data.scheduled_at}`);
          }
        },
      },
      globalOpts,
    );
  });
