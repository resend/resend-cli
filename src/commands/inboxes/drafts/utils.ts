import type { InboxDraftListItem } from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

// Drafts paginate with an opaque cursor rather than item IDs, so the picker
// only offers the first page.
export function inboxDraftPickerConfig(
  inboxId: string,
): PickerConfig<InboxDraftListItem> {
  return {
    resource: 'draft',
    resourcePlural: 'drafts',
    fetchItems: (resend) =>
      resend.inboxes.drafts.list({ inboxId }).then((r) => ({
        ...r,
        data: r.data ? { data: r.data.data, has_more: false } : null,
      })),
    display: (d) => ({
      label: d.subject ?? d.to?.join(', ') ?? '(no subject)',
      hint: d.id,
    }),
  };
}

export function renderDraftsTable(drafts: InboxDraftListItem[]): string {
  const rows = drafts.map((d) => [
    d.to?.join(', ') ?? '',
    d.subject ?? '(no subject)',
    d.type,
    d.updated_at,
    d.id,
  ]);
  return renderTable(
    ['To', 'Subject', 'Type', 'Updated', 'ID'],
    rows,
    '(no drafts)',
  );
}
