import type { Topic } from 'resend';
import { renderTable } from '../../lib/formatters';

export function renderTopicsTable(topics: Topic[]): string {
  const rows = topics.map((t) => [
    t.name,
    t.description ?? '',
    t.id,
    t.created_at,
  ]);
  return renderTable(
    ['Name', 'Description', 'ID', 'Created'],
    rows,
    '(no topics)',
  );
}
