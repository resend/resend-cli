import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const deleteWebhookCommand = new Command('delete')
  .alias('rm')
  .description('Delete a webhook endpoint and stop all event deliveries to it')
  .argument('<id>', 'Webhook UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a webhook immediately stops event delivery to the endpoint.
  In-flight events may still be attempted once before the deletion takes effect.
  To temporarily pause delivery without losing configuration, use:
    resend webhooks update <id> --status disabled

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"webhook","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend webhooks delete wh_abc123 --yes',
        'resend webhooks delete wh_abc123 --yes --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete webhook ${id}?\nEvents will no longer be delivered to this endpoint.`,
        spinner: {
          loading: 'Deleting webhook...',
          success: 'Webhook deleted',
          fail: 'Failed to delete webhook',
        },
        object: 'webhook',
        successMsg: 'Webhook deleted.',
        sdkCall: (resend) => resend.webhooks.remove(id),
      },
      globalOpts,
    );
  });
