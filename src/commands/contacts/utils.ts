import type { ContactSegmentsBaseOptions, ContactTopic } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { renderTable } from '../../lib/formatters';
import { parseJson } from '../../lib/validators';

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

const TOPICS_MESSAGE =
  'Invalid --topics JSON. Expected an array of {id, subscription} objects.';

type TopicEntry = { id: string; subscription: 'opt_in' | 'opt_out' };

function isTopicEntry(x: unknown): x is TopicEntry {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as Record<string, unknown>).id === 'string' &&
    ((x as Record<string, unknown>).subscription === 'opt_in' ||
      (x as Record<string, unknown>).subscription === 'opt_out')
  );
}

function isTopicsArray(x: unknown): x is TopicEntry[] {
  return Array.isArray(x) && x.every(isTopicEntry);
}

export function parseTopicsJson(
  raw: string,
  globalOpts: GlobalOpts,
): TopicEntry[] {
  return parseJson(
    raw,
    isTopicsArray,
    { message: TOPICS_MESSAGE, code: 'invalid_topics' },
    globalOpts,
  );
}

export function parsePropertiesJson(
  raw: string | undefined,
  globalOpts: GlobalOpts,
): Record<string, string | number | null> | undefined {
  if (!raw) {
    return undefined;
  }
  return parseJson(
    raw,
    (x): x is Record<string, string | number | null> =>
      typeof x === 'object' && x !== null && !Array.isArray(x),
    { message: 'Invalid --properties JSON.', code: 'invalid_properties' },
    globalOpts,
  );
}
