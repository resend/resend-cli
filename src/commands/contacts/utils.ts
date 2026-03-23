import type { ContactSegmentsBaseOptions, ContactTopic } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { outputError } from '../../lib/output';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

// ─── Table renderers ─────────────────────────────────────────────────────────

export function renderContactsTable(
  contacts: Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    unsubscribed: boolean;
  }>,
): string {
  const rows = contacts.map((c) => [
    c.email,
    c.first_name ?? '',
    c.last_name ?? '',
    c.unsubscribed ? 'yes' : 'no',
    c.id,
  ]);
  return renderTable(
    ['Email', 'First Name', 'Last Name', 'Unsubscribed', 'ID'],
    rows,
    '(no contacts)',
  );
}

export function renderContactTopicsTable(topics: ContactTopic[]): string {
  const rows = topics.map((t) => [
    t.name,
    t.subscription,
    t.id,
    t.description ?? '',
  ]);
  return renderTable(
    ['Name', 'Subscription', 'ID', 'Description'],
    rows,
    '(no topic subscriptions)',
  );
}

export const contactPickerConfig: PickerConfig<{
  id: string;
  email: string;
}> = {
  resource: 'contact',
  resourcePlural: 'contacts',
  fetchItems: (resend, { limit, after }) =>
    resend.contacts.list({ limit, ...(after && { after }) }),
  display: (c) => ({ label: c.email, hint: c.id }),
};

// ─── Contact identifier helpers ───────────────────────────────────────────────
//
// The Resend SDK uses two different discriminated-union shapes depending on
// the API surface:
//
//   • contactIdentifier  — produces { id } | { email } for endpoints that
//     accept SelectingField (update, get, remove) or { id?, email? }
//     (topics list/update).
//
//   • segmentContactIdentifier — produces { contactId } | { email } for the
//     contacts.segments.* endpoints, which use ContactSegmentsBaseOptions.
//
// Centralising the `str.includes('@')` check here prevents it from drifting
// across six separate command files.

export function contactIdentifier(
  id: string,
): { id: string } | { email: string } {
  return id.includes('@') ? { email: id } : { id };
}

export function segmentContactIdentifier(
  id: string,
): ContactSegmentsBaseOptions {
  return id.includes('@') ? { email: id } : { contactId: id };
}

// ─── JSON flag helpers ────────────────────────────────────────────────────────

export function parseTopicsJson(
  raw: string,
  globalOpts: GlobalOpts,
): Array<{ id: string; subscription: 'opt_in' | 'opt_out' }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    outputError(
      {
        message:
          'Invalid --topics JSON. Expected an array of {id, subscription} objects.',
        code: 'invalid_topics',
      },
      { json: globalOpts.json },
    );
  }
  if (!Array.isArray(parsed)) {
    outputError(
      {
        message:
          'Invalid --topics JSON. Expected an array of {id, subscription} objects.',
        code: 'invalid_topics',
      },
      { json: globalOpts.json },
    );
  }
  return parsed as Array<{ id: string; subscription: 'opt_in' | 'opt_out' }>;
}

export function parsePropertiesJson(
  raw: string | undefined,
  globalOpts: GlobalOpts,
): Record<string, string | number | null> | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as Record<string, string | number | null>;
  } catch {
    outputError(
      { message: 'Invalid --properties JSON.', code: 'invalid_properties' },
      { json: globalOpts.json },
    );
  }
}
