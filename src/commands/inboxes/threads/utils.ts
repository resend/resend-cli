import type {
  InboxMessage,
  InboxMessageFolder,
  InboxThread,
  ListInboxThreadsOptions,
} from 'resend';
import type { GlobalOpts } from '../../../lib/client';
import { outputError } from '../../../lib/output';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

export const collectValues = (value: string, previous: string[]) => [
  ...previous,
  value,
];

type ThreadFilterOpts = {
  folder?: InboxMessageFolder[];
  label: string[];
  read?: true;
  unread?: true;
};

export function threadFilters(
  opts: ThreadFilterOpts,
  globalOpts: GlobalOpts,
): Pick<ListInboxThreadsOptions, 'folders' | 'labels' | 'read'> {
  if (opts.read && opts.unread) {
    outputError(
      {
        message: 'Use either --read or --unread, not both.',
        code: 'invalid_options',
      },
      { json: globalOpts.json },
    );
  }

  return {
    folders: opts.folder,
    labels: opts.label.length > 0 ? opts.label : undefined,
    read: opts.read ? true : opts.unread ? false : undefined,
  };
}

export function threadFilterFlags(opts: ThreadFilterOpts): string[] {
  return [
    ...(opts.folder ?? []).map((folder) => `--folder ${folder}`),
    ...opts.label.map((label) => `--label ${label}`),
    ...(opts.read ? ['--read'] : []),
    ...(opts.unread ? ['--unread'] : []),
  ];
}

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
