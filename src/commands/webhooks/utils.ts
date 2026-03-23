import type { Webhook, WebhookEvent } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.opened',
  'email.clicked',
  'email.failed',
  'email.scheduled',
  'email.suppressed',
  'email.received',
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'domain.created',
  'domain.updated',
  'domain.deleted',
];

export function normalizeEvents(raw: string[]): string[] {
  return raw
    .flatMap((e) => e.split(','))
    .map((e) => e.trim())
    .filter(Boolean);
}

export const webhookPickerConfig: PickerConfig<{
  id: string;
  endpoint: string;
}> = {
  resource: 'webhook',
  resourcePlural: 'webhooks',
  fetchItems: (resend, { limit, after }) =>
    resend.webhooks.list({ limit, ...(after && { after }) }),
  display: (w) => ({ label: w.endpoint, hint: w.id }),
};

export function renderWebhooksTable(webhooks: Webhook[]): string {
  const rows = webhooks.map((w) => {
    const eventsStr = (w.events ?? []).join(', ');
    const events =
      eventsStr.length > 60 ? `${eventsStr.slice(0, 57)}...` : eventsStr;
    return [w.endpoint, events, w.status, w.id];
  });
  return renderTable(
    ['Endpoint', 'Events', 'Status', 'ID'],
    rows,
    '(no webhooks)',
  );
}
