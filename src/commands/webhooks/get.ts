import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const getWebhookCommand = new Command('get')
  .description('Retrieve a webhook endpoint configuration by ID')
  .argument('<id>', 'Webhook UUID')
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
    })
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching webhook...');

    try {
      const { data, error } = await resend.webhooks.get(id);

      if (error) {
        spinner.fail('Failed to fetch webhook');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Webhook fetched');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\n${d.endpoint}`);
        console.log(`ID:      ${d.id}`);
        console.log(`Status:  ${d.status}`);
        console.log(`Events:  ${(d.events ?? []).join(', ') || '(none)'}`);
        console.log(`Created: ${d.created_at}`);
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch webhook');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'fetch_error' }, { json: globalOpts.json });
    }
  });
