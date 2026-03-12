import type { ListTemplatesResponseSuccess } from 'resend';
import { renderTable } from '../../lib/table';

export function renderTemplatesTable(
  templates: ListTemplatesResponseSuccess['data'],
): string {
  const rows = templates.map((t) => [
    t.name,
    t.status,
    t.alias ?? '',
    t.id,
    t.created_at,
  ]);
  return renderTable(
    ['Name', 'Status', 'Alias', 'ID', 'Created'],
    rows,
    '(no templates)',
  );
}
