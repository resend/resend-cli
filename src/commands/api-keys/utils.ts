import { renderTable } from '../../lib/formatters';

export function renderApiKeysTable(
  keys: Array<{ id: string; name: string; created_at: string }>,
): string {
  const rows = keys.map((k) => [k.name, k.id, k.created_at]);
  return renderTable(['Name', 'ID', 'Created'], rows, '(no API keys)');
}
