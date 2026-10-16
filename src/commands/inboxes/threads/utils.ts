import type {
  InboxMessage,
  InboxMessageFolder,
  InboxThread,
  InboxThreadSearchResult,
  ListInboxThreadsOptions,
} from 'resend';
import type { GlobalOpts } from '../../../lib/client';
import { outputError } from '../../../lib/output';
import type { PickerConfig } from '../../../lib/prompts';
import { safeTerminalText } from '../../../lib/safe-terminal-text';
import { renderTable } from '../../../lib/table';
import { inboxSelector } from '../utils';

type ThreadFilterOpts = {
  folders?: InboxMessageFolder[];
  labels?: string[];
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
    folders: opts.folders,
    labels: opts.labels,
    read: opts.read ? true : opts.unread ? false : undefined,
  };
}

export function threadFilterFlags(opts: ThreadFilterOpts): string[] {
  return [
    ...(opts.folders ? [`--folders ${opts.folders.join(' ')}`] : []),
    ...(opts.labels ? [`--labels ${opts.labels.join(' ')}`] : []),
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
      resend.inboxes.threads.list({
        ...inboxSelector(inboxId),
        limit,
        ...(after && { after }),
      }),
    display: (t) => ({
      label: safeTerminalText(t.subject ?? '') || '(no subject)',
      hint: t.id,
    }),
  };
}

export function renderThreadsTable(threads: InboxThread[]): string {
  const rows = threads.map((t) => [
    t.from ?? '',
    t.subject ?? '(no subject)',
    t.read ? 'yes' : 'no',
    String(t.email_count),
    t.received_at,
    t.id,
  ]);
  return renderTable(
    ['From', 'Subject', 'Read', 'Emails', 'Received', 'ID'],
    rows,
    '(no threads)',
  );
}

export function renderThreadSearchTable(
  results: InboxThreadSearchResult[],
): string {
  const rows = results.map((t) => [
    t.from ?? '',
    t.subject ?? '(no subject)',
    t.read ? 'yes' : 'no',
    t.received_at,
    t.id,
    t.matched_email_id ?? '',
  ]);
  return renderTable(
    ['From', 'Subject', 'Read', 'Received', 'ID', 'Matched email'],
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
