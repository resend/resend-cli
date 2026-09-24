import type { InboxDraftListItem } from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

export function inboxDraftPickerConfig(
  inboxId: string,
): PickerConfig<InboxDraftListItem> {
  return {
    resource: 'draft',
    resourcePlural: 'drafts',
    fetchItems: (resend, { limit, after }) =>
      resend.inboxes.drafts.list({ inboxId, limit, ...(after && { after }) }),
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
