import type { InboxThreadSearchResult } from 'resend';
import { describe, expect, it } from 'vitest';
import {
  firstMatchSnippet,
  inboxThreadPickerConfig,
  renderThreadSearchTable,
} from '../../../../src/commands/inboxes/threads/utils';

const result = (
  highlights: InboxThreadSearchResult['highlights'],
): InboxThreadSearchResult => ({
  id: '3deaccfa-f572-443c-be6f-92b74f9d5c48',
  subject: 'September invoice',
  from: 'Isabella <isabella@example.com>',
  to: [],
  cc: [],
  bcc: [],
  labels: [],
  email_count: 3,
  has_attachment: true,
  has_draft: false,
  read: false,
  received_at: '2026-09-24T14:12:08.000Z',
  folder: 'inbox',
  matched_email_id: '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5',
  highlights,
});

describe('firstMatchSnippet', () => {
  it('prefers a body match over the subject, which the table already shows', () => {
    expect(
      firstMatchSnippet({
        subject: ['September **invoice**'],
        body: ['Attached is the **invoice** for September.'],
      }),
    ).toBe('body: Attached is the invoice for September.');
  });

  it('falls back to the subject when nothing else matched', () => {
    expect(firstMatchSnippet({ subject: ['September **invoice**'] })).toBe(
      'subject: September invoice',
    );
  });

  it('truncates long snippets to 60 characters', () => {
    const snippet = firstMatchSnippet({ body: ['a'.repeat(100)] });
    expect(snippet).toHaveLength(60);
    expect(snippet.endsWith('...')).toBe(true);
  });

  it('is empty when the search had no query', () => {
    expect(firstMatchSnippet({})).toBe('');
  });
});

describe('renderThreadSearchTable', () => {
  it('shows the matched snippet in a Match column', () => {
    const table = renderThreadSearchTable([
      result({ attachments: ['**invoice**-2026-09.pdf'] }),
    ]);
    expect(table).toContain('Match');
    expect(table).toContain('attachments: invoice-2026-09.pdf');
  });
});

describe('inboxThreadPickerConfig', () => {
  const display = inboxThreadPickerConfig(
    '78261eea-8f8b-4381-83c6-79fa7120f1cf',
  ).display;

  it('strips terminal control sequences from the subject', () => {
    const { label } = display({
      ...result({}),
      subject: '\u001b[2J\u001b[31mFake prompt\u0007',
    });
    expect(label).toBe('Fake prompt');
  });

  it('shows (no subject) for an empty subject', () => {
    expect(display({ ...result({}), subject: '' }).label).toBe('(no subject)');
  });
});
