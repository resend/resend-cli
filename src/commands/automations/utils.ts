import type { PickerConfig } from '../../lib/prompts';
import { renderTable, type StatusTone } from '../../lib/table';
import { isUnicodeSupported } from '../../lib/tty';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const CIRCLE = isUnicodeSupported ? String.fromCodePoint(0x25cb) : 'o'; // ○

export function renderAutomationsTable(
  automations: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
  }>,
): string {
  const rows = automations.map((a) => [
    a.name,
    statusIndicator(a.status),
    a.created_at,
    a.id,
  ]);
  return renderTable(
    ['Name', 'Status', 'Created', 'ID'],
    rows,
    '(no automations)',
    {
      statusColumn: {
        index: 1,
        tones: automations.map((a) => automationStatusTone(a.status)),
      },
    },
  );
}

export function statusIndicator(status: string): string {
  switch (status) {
    case 'enabled':
      return `${CHECK} Enabled`;
    case 'disabled':
      return `${CIRCLE} Disabled`;
    default:
      return status;
  }
}

function automationStatusTone(status: string): StatusTone {
  switch (status) {
    case 'enabled':
      return 'success';
    case 'disabled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export const automationPickerConfig: PickerConfig<{
  id: string;
  name: string;
}> = {
  resource: 'automation',
  resourcePlural: 'automations',
  fetchItems: (resend, { limit, after }) =>
    resend.automations.list({ limit, ...(after && { after }) }),
  display: (a) => ({ label: a.name, hint: a.id }),
};
