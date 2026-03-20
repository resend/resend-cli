import type { Webhook, WebhookEvent } from 'resend';
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
