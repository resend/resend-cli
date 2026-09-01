import type {
  ListWebhookEventAttemptsResponseSuccess,
  ListWebhookEventsResponseSuccess,
} from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

export function webhookEventPickerConfig(
  webhookId: string,
): PickerConfig<{ id: string; type: string; status: string }> {
  return {
    resource: 'webhook event',
    resourcePlural: 'webhook events',
    fetchItems: (resend, { limit, after }) =>
      resend.webhooks.events.list({
        webhookId,
        limit,
        ...(after && { after }),
      }),
    display: (e) => ({ label: `${e.type} (${e.status})`, hint: e.id }),
  };
}

export function renderWebhookEventsTable(
  events: ListWebhookEventsResponseSuccess['data'],
): string {
  const rows = events.map((e) => [e.type, e.status, e.created_at, e.id]);
  return renderTable(
    ['Type', 'Status', 'Created', 'ID'],
    rows,
    '(no webhook events)',
  );
}

export function renderWebhookEventAttemptsTable(
  attempts: ListWebhookEventAttemptsResponseSuccess['data'],
): string {
  const rows = attempts.map((a) => {
    const response = a.response.replace(/\s+/g, ' ').trim();
    return [
      String(a.http_status_code),
      a.sent_at,
      response.length > 60 ? `${response.slice(0, 57)}...` : response,
      a.id,
    ];
  });
  return renderTable(
    ['Status', 'Sent', 'Response', 'ID'],
    rows,
    '(no delivery attempts)',
  );
}
