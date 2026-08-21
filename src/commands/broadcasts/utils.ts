import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export function broadcastStatusIndicator(status: string): string {
  switch (status) {
    case 'draft':
      return '○ Draft';
    case 'queued':
      return '⏳ Queued';
    case 'scheduled':
      return '📅 Scheduled';
    case 'sent':
      return '✓ Sent';
    default:
      return status;
  }
}

export const broadcastPickerConfig: PickerConfig<{
  id: string;
  name: string | null;
}> = {
  resource: 'broadcast',
  resourcePlural: 'broadcasts',
  fetchItems: (resend, { limit, after }) =>
    resend.broadcasts.list({ limit, ...(after && { after }) }),
  display: (b) => ({ label: b.name ?? '(untitled)', hint: b.id }),
};

type StatusFilteredBroadcast = {
  id: string;
  name: string | null;
  status: string;
};

function statusFilteredBroadcastPickerConfig(
  filter: (b: StatusFilteredBroadcast) => boolean,
): PickerConfig<StatusFilteredBroadcast> {
  return {
    resource: 'broadcast',
    resourcePlural: 'broadcasts',
    fetchItems: (resend, { limit, after }) =>
      resend.broadcasts.list({ limit, ...(after && { after }) }),
    display: (b) => ({
      label: b.name ?? '(untitled)',
      hint: `${broadcastStatusIndicator(b.status)}  ${b.id}`,
    }),
    filter,
  };
}

export const sendBroadcastPickerConfig = statusFilteredBroadcastPickerConfig(
  (b) => b.status === 'draft',
);

export const cancelBroadcastPickerConfig = statusFilteredBroadcastPickerConfig(
  (b) => b.status === 'queued' || b.status === 'scheduled',
);

export function renderBroadcastsTable(
  broadcasts: Array<{
    id: string;
    name: string | null;
    status: string;
    created_at: string;
  }>,
): string {
  const rows = broadcasts.map((b) => [
    b.name ?? '(untitled)',
    b.status,
    b.created_at,
    b.id,
  ]);
  return renderTable(
    ['Name', 'Status', 'Created', 'ID'],
    rows,
    '(no broadcasts)',
  );
}

export function renderBroadcastRecipientsTable(
  recipients: Array<{
    id: string;
    contact_id: string | null;
    email: string;
    count?: number;
    bounce_type?: string;
    clicked_links?: Array<{ url: string; clicks: number }>;
  }>,
): string {
  const rows = recipients.map((r) => [
    r.email,
    r.contact_id ?? '-',
    r.count !== undefined ? String(r.count) : '-',
    r.bounce_type ?? '-',
    r.clicked_links && r.clicked_links.length > 0
      ? r.clicked_links.map((l) => `${l.url} (${l.clicks})`).join(', ')
      : '-',
    r.id,
  ]);
  return renderTable(
    ['Email', 'Contact ID', 'Count', 'Bounce Type', 'Clicked Links', 'ID'],
    rows,
    '(no recipients)',
  );
}

export function renderBroadcastClickedLinksTable(
  links: Array<{
    url: string;
    clicks: number;
    unique_clicks: number;
  }>,
): string {
  const rows = links.map((l) => [
    l.url,
    String(l.clicks),
    String(l.unique_clicks),
  ]);
  return renderTable(
    ['URL', 'Clicks', 'Unique Clicks'],
    rows,
    '(no clicked links)',
  );
}
