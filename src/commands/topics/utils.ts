import type { Topic } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const topicPickerConfig: PickerConfig<{ id: string; name: string }> = {
  resource: 'topic',
  resourcePlural: 'topics',
  fetchItems: (resend) =>
    resend.topics.list().then((r) => ({
      ...r,
      data: r.data ? { data: r.data.data, has_more: false } : null,
    })),
  display: (t) => ({ label: t.name, hint: t.id }),
};

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
