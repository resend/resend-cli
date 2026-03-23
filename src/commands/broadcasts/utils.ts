import type { PickerConfig } from '../../lib/prompts';
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

export const sendBroadcastPickerConfig: PickerConfig<{
  id: string;
  name: string | null;
  status: string;
}> = {
  resource: 'broadcast',
  resourcePlural: 'broadcasts',
  fetchItems: async (resend, { limit, after }) => {
    const result = await resend.broadcasts.list({
      limit,
      ...(after && { after }),
    });
    if (result.error || !result.data) {
      return result as {
        data: {
          data: { id: string; name: string | null; status: string }[];
          has_more?: boolean;
        } | null;
        error: { message: string } | null;
      };
    }
    return {
      data: {
        data: result.data.data.filter(
          (b: { status: string }) => b.status === 'draft',
        ),
        has_more: result.data.has_more,
      },
      error: null,
    };
  },
  display: (b) => ({
    label: b.name ?? '(untitled)',
    hint: `${broadcastStatusIndicator(b.status)}  ${b.id}`,
  }),
};

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
