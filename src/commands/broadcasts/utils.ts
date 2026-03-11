import { renderTable } from '../../lib/table';

export function broadcastStatusIndicator(status: string): string {
  switch (status) {
    case 'draft':
      return '○ Draft';
    case 'queued':
      return '⏳ Queued';
    case 'sent':
      return '✓ Sent';
    default:
      return status;
  }
}

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
