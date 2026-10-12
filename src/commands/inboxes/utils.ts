import type { Inbox } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const inboxPickerConfig: PickerConfig<Inbox> = {
  resource: 'inbox',
  resourcePlural: 'inboxes',
  fetchItems: (resend, { limit, after }) =>
    resend.inboxes.list({ limit, ...(after && { after }) }),
  display: (i) => ({ label: i.email_address, hint: i.id }),
};

export function renderInboxesTable(inboxes: Inbox[]): string {
  const rows = inboxes.map((i) => [
    i.email_address,
    i.name ?? '',
    String(i.unread),
    i.id,
  ]);
  return renderTable(['Email', 'Name', 'Unread', 'ID'], rows, '(no inboxes)');
}
