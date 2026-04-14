import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { webhookPickerConfig } from './utils';

export const deleteWebhookCommand = new Command('delete')
  .alias('rm')
  .description('Delete a webhook endpoint and stop all event deliveries to it')
  .argument('[id]', 'Webhook UUID')
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
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, webhookPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete webhook "${picked.label}"?\nID: ${picked.id}\nEvents will no longer be delivered to this endpoint.`,
        loading: 'Deleting webhook...',
        object: 'webhook',
        successMsg: 'Webhook deleted',
        sdkCall: (resend) => resend.webhooks.remove(picked.id),
      },
      globalOpts,
    );
  });
