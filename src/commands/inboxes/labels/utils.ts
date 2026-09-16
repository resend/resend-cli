import type { InboxLabel } from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

export function inboxLabelPickerConfig(
  inboxId: string,
): PickerConfig<InboxLabel> {
  return {
    resource: 'label',
    resourcePlural: 'labels',
    fetchItems: (resend) =>
      resend.inboxes.labels.list({ inboxId }).then((r) => ({
        ...r,
        data: r.data ? { data: r.data.data, has_more: false } : null,
      })),
    display: (l) => ({ label: l.name, hint: l.id }),
  };
}

export function renderLabelsTable(labels: InboxLabel[]): string {
  const rows = labels.map((l) => [l.name, l.color, l.created_at, l.id]);
  return renderTable(['Name', 'Color', 'Created', 'ID'], rows, '(no labels)');
}
