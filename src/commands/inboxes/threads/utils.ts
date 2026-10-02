import type { InboxMessage, InboxThread } from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

export function inboxThreadPickerConfig(
  inboxId: string,
): PickerConfig<InboxThread> {
  return {
    resource: 'thread',
    resourcePlural: 'threads',
    fetchItems: (resend, { limit, after }) =>
      resend.inboxes.threads.list({ inboxId, limit, ...(after && { after }) }),
    display: (t) => ({ label: t.subject ?? '(no subject)', hint: t.id }),
  };
}

export function renderThreadsTable(threads: InboxThread[]): string {
  const rows = threads.map((t) => [
    t.from ?? '',
    t.subject ?? '(no subject)',
    t.read ? 'yes' : 'no',
    String(t.message_count),
    t.received_at,
    t.id,
  ]);
  return renderTable(
    ['From', 'Subject', 'Read', 'Msgs', 'Received', 'ID'],
    rows,
    '(no threads)',
  );
}

export function renderThreadEmailsTable(emails: InboxMessage[]): string {
  const rows = emails.map((e) => [
    e.direction,
    e.from,
    e.subject ?? '(no subject)',
    e.received_at,
    e.id,
  ]);
  return renderTable(
    ['Direction', 'From', 'Subject', 'Received', 'ID'],
    rows,
    '(no emails)',
  );
}
