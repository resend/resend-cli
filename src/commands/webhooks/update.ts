import { Command, Option } from '@commander-js/extra-typings';
import type { WebhookEvent } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { ALL_WEBHOOK_EVENTS, normalizeEvents } from './utils';

export const updateWebhookCommand = new Command('update')
  .description(
    "Update a webhook's endpoint URL, event subscriptions, or enabled status",
  )
  .argument('<id>', 'Webhook UUID')
  .option('--endpoint <endpoint>', 'New HTTPS URL for this webhook')
  .option(
    '--events <events...>',
    'Replace the full event subscription list (comma or space-separated). Use "all" for all 17 events.',
  )
  .addOption(
    new Option(
      '--status <status>',
      'Enable or disable event delivery for this webhook',
    ).choices(['enabled', 'disabled'] as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --endpoint, --events, or --status must be provided.

--events replaces the entire event list (it is not additive).
Use "all" as a shorthand for all 17 event types.

--status controls whether events are delivered to this endpoint:
  enabled   Events are delivered (default on creation)
  disabled  Events are suppressed without deleting the webhook`,
      output: `  {"object":"webhook","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend webhooks update wh_abc123 --endpoint https://new-app.example.com/hooks/resend',
        'resend webhooks update wh_abc123 --events email.sent email.bounced',
        'resend webhooks update wh_abc123 --events all',
        'resend webhooks update wh_abc123 --status disabled',
        'resend webhooks update wh_abc123 --endpoint https://new-app.example.com/hooks/resend --events all --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (!opts.endpoint && !opts.events?.length && !opts.status) {
      outputError(
        {
          message:
            'Provide at least one option to update: --endpoint, --events, or --status.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const normalized = opts.events?.length
      ? normalizeEvents(opts.events)
      : undefined;
    const selectedEvents = normalized?.includes('all')
      ? ALL_WEBHOOK_EVENTS
      : normalized?.length
        ? (normalized as WebhookEvent[])
        : undefined;

    await runWrite(
      {
        spinner: {
          loading: 'Updating webhook...',
          success: 'Webhook updated',
          fail: 'Failed to update webhook',
        },
        sdkCall: (resend) =>
          resend.webhooks.update(id, {
            ...(opts.endpoint && { endpoint: opts.endpoint }),
            ...(selectedEvents?.length && { events: selectedEvents }),
            ...(opts.status && { status: opts.status }),
          }),
        errorCode: 'update_error',
        successMsg: `Webhook updated: ${id}`,
      },
      globalOpts,
    );
  });
