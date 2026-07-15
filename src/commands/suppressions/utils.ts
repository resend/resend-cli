import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

type SuppressionEntry = {
  id: string;
  email: string;
  origin: 'bounce' | 'complaint' | 'manual';
  source_id: string | null;
  created_at: string;
};

export const suppressionPickerConfig: PickerConfig<SuppressionEntry> = {
  resource: 'suppression',
  resourcePlural: 'suppressions',
  fetchItems: (resend, { limit, after }) =>
    resend.suppressions.list({ limit, ...(after && { after }) }),
  display: (s) => ({ label: s.email, hint: s.id }),
};

export function renderSuppressionsTable(
  entries: Array<SuppressionEntry>,
): string {
  const rows = entries.map((s) => [s.email, s.id, s.origin, s.created_at]);
  return renderTable(
    ['Email', 'ID', 'Origin', 'Created'],
    rows,
    '(no suppressions)',
  );
}
