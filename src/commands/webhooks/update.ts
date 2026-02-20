import { Command, Option } from '@commander-js/extra-typings';
import type { WebhookEvent } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { ALL_WEBHOOK_EVENTS } from './utils';

export const updateWebhookCommand = new Command('update')
  .description("Update a webhook's endpoint URL, event subscriptions, or enabled status")
  .argument('<id>', 'Webhook UUID')
  .option('--endpoint <endpoint>', 'New HTTPS URL for this webhook')
  .option('--events <events...>', 'Replace the full event subscription list. Use "all" for all 17 events.')
  .addOption(
    new Option('--status <status>', 'Enable or disable event delivery for this webhook')
      .choices(['enabled', 'disabled'] as const)
  )
  .addHelpText(
    'after',
    `
At least one of --endpoint, --events, or --status must be provided.

--events replaces the entire event list (it is not additive).
Use "all" as a shorthand for all 17 event types.

--status controls whether events are delivered to this endpoint:
  enabled   Events are delivered (default on creation)
  disabled  Events are suppressed without deleting the webhook

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"webhook","id":"<uuid>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | no_changes | update_error

Examples:
  $ resend webhooks update wh_abc123 --endpoint https://new-app.example.com/hooks/resend
  $ resend webhooks update wh_abc123 --events email.sent email.bounced
  $ resend webhooks update wh_abc123 --events all
  $ resend webhooks update wh_abc123 --status disabled
  $ resend webhooks update wh_abc123 --endpoint https://new-app.example.com/hooks/resend --events all --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.endpoint && !opts.events?.length && !opts.status) {
      outputError(
        { message: 'Provide at least one option to update: --endpoint, --events, or --status.', code: 'no_changes' },
        { json: globalOpts.json }
      );
    }

    const selectedEvents = opts.events?.includes('all')
      ? ALL_WEBHOOK_EVENTS
      : (opts.events as WebhookEvent[] | undefined);

    const spinner = createSpinner('Updating webhook...');

    try {
      const { data, error } = await resend.webhooks.update(id, {
        ...(opts.endpoint && { endpoint: opts.endpoint }),
        ...(selectedEvents?.length && { events: selectedEvents }),
        ...(opts.status && { status: opts.status }),
      });

      if (error) {
        spinner.fail('Failed to update webhook');
        outputError({ message: error.message, code: 'update_error' }, { json: globalOpts.json });
      }

      spinner.stop('Webhook updated');

      if (!globalOpts.json && isInteractive()) {
        console.log(`Webhook updated: ${id}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to update webhook');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'update_error' }, { json: globalOpts.json });
    }
  });
