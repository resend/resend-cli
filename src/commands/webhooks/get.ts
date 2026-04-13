import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { webhookPickerConfig } from './utils';

export const getWebhookCommand = new Command('get')
  .description('Retrieve a webhook endpoint configuration by ID')
  .argument('[id]', 'Webhook UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: The signing_secret is not returned by the get endpoint.
To rotate secrets, delete the webhook and recreate it.`,
      output: `  {"object":"webhook","id":"<uuid>","endpoint":"<url>","events":["<event>"],"status":"enabled|disabled","created_at":"<iso-date>","signing_secret":"<whsec_...>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend webhooks get wh_abc123',
        'resend webhooks get wh_abc123 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, webhookPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching webhook...',
        sdkCall: (resend) => resend.webhooks.get(id),
        onInteractive: (d) => {
          console.log(`${d.endpoint}`);
          console.log(`ID:      ${d.id}`);
          console.log(`Status:  ${d.status}`);
          console.log(`Events:  ${(d.events ?? []).join(', ') || '(none)'}`);
          console.log(`Created: ${d.created_at}`);
        },
      },
      globalOpts,
    );
  });
