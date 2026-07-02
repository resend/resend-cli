import type { PickerConfig } from '../../lib/prompts';
import { renderTable, type StatusTone } from '../../lib/table';
import { isUnicodeSupported } from '../../lib/tty';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const HOURGLASS = isUnicodeSupported ? String.fromCodePoint(0x23f3) : '~'; // ⏳
const CIRCLE = isUnicodeSupported ? String.fromCodePoint(0x25cb) : 'o'; // ○

export function broadcastStatusIndicator(status: string): string {
  switch (status) {
    case 'draft':
      return `${CIRCLE} Draft`;
    case 'queued':
      return `${HOURGLASS} Queued`;
    case 'sent':
      return `${CHECK} Sent`;
    default:
      return status;
  }
}

function broadcastStatusTone(status: string): StatusTone {
  switch (status) {
    case 'sent':
      return 'success';
    case 'queued':
      return 'pending';
    case 'draft':
      return 'neutral';
    default:
      return 'neutral';
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
  fetchItems: (resend, { limit, after }) =>
    resend.broadcasts.list({ limit, ...(after && { after }) }),
  display: (b) => ({
    label: b.name ?? '(untitled)',
    hint: `${broadcastStatusIndicator(b.status)}  ${b.id}`,
  }),
  filter: (b) => b.status === 'draft',
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
    {
      statusColumn: {
        index: 1,
        tones: broadcasts.map((b) => broadcastStatusTone(b.status)),
      },
    },
  );
}
