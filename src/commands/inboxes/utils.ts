import type { Inbox, InboxSelector } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { outputError } from '../../lib/output';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const inboxPickerConfig: PickerConfig<Inbox> = {
  resource: 'inbox',
  resourcePlural: 'inboxes',
  fetchItems: (resend, { limit, after }) =>
    resend.inboxes.list({ limit, ...(after && { after }) }),
  display: (i) => ({ label: i.email_address, hint: i.id }),
};

export function inboxSelector(inbox: string): InboxSelector {
  return inbox.includes('@') ? { emailAddress: inbox } : { inboxId: inbox };
}

type IdInput = [arg: string | undefined, flag: string | undefined];

export function resolveIdInputs<K extends string>(
  ids: Record<K, IdInput>,
  globalOpts: GlobalOpts,
): Record<K, string | undefined> {
  const names = Object.keys(ids) as K[];
  for (const name of names) {
    const [arg, flag] = ids[name];
    if (arg !== undefined && flag !== undefined) {
      outputError(
        {
          message: `Use either the <${name}Id> argument or --${name}-id, not both. The arguments go in this order: ${names.map((n) => `<${n}Id>`).join(' ')}.`,
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }
  }
  return Object.fromEntries(
    names.map((name) => [name, ids[name][0] ?? ids[name][1]]),
  ) as Record<K, string | undefined>;
}

export function renderInboxesTable(inboxes: Inbox[]): string {
  const rows = inboxes.map((i) => [
    i.email_address,
    i.name ?? '',
    String(i.unread),
    i.id,
  ]);
  return renderTable(['Email', 'Name', 'Unread', 'ID'], rows, '(no inboxes)');
}
