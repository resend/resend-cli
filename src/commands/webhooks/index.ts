import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createWebhookCommand } from './create';
import { deleteWebhookCommand } from './delete';
import { getWebhookCommand } from './get';
import { listWebhooksCommand } from './list';
import { updateWebhookCommand } from './update';

export const webhooksCommand = new Command('webhooks')
  .description('Manage webhook endpoints for real-time event notifications')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Webhooks let you receive real-time event notifications from Resend at an HTTPS endpoint.
Payloads are signed with Svix headers for verification.

As of January 2026, webhook events fire per-recipient. A batch email to 3 recipients
generates 3 email.sent events. The "to" field remains an array for backward compatibility
but contains one entry per event.

Event categories (17 total):
  Email:   email.sent, email.delivered, email.delivery_delayed, email.bounced,
           email.complained, email.opened, email.clicked, email.failed,
           email.scheduled, email.suppressed, email.received
  Contact: contact.created, contact.updated, contact.deleted
  Domain:  domain.created, domain.updated, domain.deleted

Signature verification (Svix):
  Each delivery includes headers: svix-id, svix-timestamp, svix-signature
  Verify payloads in your application using: resend.webhooks.verify({ payload, headers, webhookSecret })`,
      examples: [
        'resend webhooks list',
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events all',
        'resend webhooks get wh_abc123',
        'resend webhooks update wh_abc123 --status disabled',
        'resend webhooks delete wh_abc123 --yes',
      ],
    }),
  )
  .addCommand(createWebhookCommand)
  .addCommand(getWebhookCommand)
  .addCommand(listWebhooksCommand, { isDefault: true })
  .addCommand(updateWebhookCommand)
  .addCommand(deleteWebhookCommand);
