import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { inboxPickerConfig } from './utils';

export const getInboxCommand = new Command('get')
  .description('Retrieve an inbox by ID or email address')
  .argument('[id]', 'Inbox UUID or inbox email address')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"inbox","id":"<uuid>","name":"<name>","email_address":"<address>","domain_id":"<uuid>","receiving_address":"<address>|null","from_name":"<name>|null","unread":0,"drafts":0,"last_received":"<date>|null","created_at":"<date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
        'resend inboxes get support@yourdomain.com --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, inboxPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching inbox...',
        sdkCall: (resend) => resend.inboxes.get(id),
        onInteractive: (data) => {
          console.log(`${data.email_address}`);
          console.log(`ID: ${data.id}`);
          console.log(`Name: ${data.name}`);
          if (data.from_name) {
            console.log(`From name: ${data.from_name}`);
          }
          if (data.receiving_address) {
            console.log(`Receiving address: ${data.receiving_address}`);
          }
          console.log(`Unread: ${data.unread}`);
          console.log(`Drafts: ${data.drafts}`);
          if (data.last_received) {
            console.log(`Last received: ${data.last_received}`);
          }
        },
      },
      globalOpts,
    );
  });
