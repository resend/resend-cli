import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const deleteWebhookCommand = new Command('delete')
  .description('Delete a webhook endpoint and stop all event deliveries to it')
  .argument('<id>', 'Webhook UUID')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    `
⚠ Deleting a webhook immediately stops event delivery to the endpoint.
  In-flight events may still be attempted once before the deletion takes effect.
  To temporarily pause delivery without losing configuration, use:
    resend webhooks update <id> --status disabled

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"webhook","id":"<uuid>","deleted":true}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | confirmation_required | delete_error

Examples:
  $ resend webhooks delete wh_abc123 --yes
  $ resend webhooks delete wh_abc123 --yes --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(
        id,
        `Delete webhook ${id}? Events will no longer be delivered to this endpoint.`,
        globalOpts
      );
    }

    const spinner = createSpinner('Deleting webhook...');

    try {
      const { error } = await resend.webhooks.remove(id);

      if (error) {
        spinner.fail('Failed to delete webhook');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Webhook deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('Webhook deleted.');
      } else {
        outputResult({ object: 'webhook', id, deleted: true }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete webhook');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'delete_error' }, { json: globalOpts.json });
    }
  });
