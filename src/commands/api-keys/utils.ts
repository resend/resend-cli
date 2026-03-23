import { renderTable } from '../../lib/table';

export function renderApiKeysTable(
  keys: Array<{
    id: string;
    name: string;
    created_at: string;
    last_used_at: string | null;
  }>,
): string {
  const rows = keys.map((k) => [
    k.name,
    k.id,
    k.created_at,
    k.last_used_at ?? '',
  ]);
  return renderTable(
    ['Name', 'ID', 'Created', 'Last used'],
    rows,
    '(no API keys)',
  );
}
