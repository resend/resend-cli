import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

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
  );
}

export function statusIndicator(status: string): string {
  switch (status) {
    case 'enabled':
      return '✓ Enabled';
    case 'disabled':
      return '○ Disabled';
    default:
      return status;
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
