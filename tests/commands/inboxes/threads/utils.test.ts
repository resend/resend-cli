import type { InboxThreadSearchResult } from 'resend';
import { describe, expect, it, vi } from 'vitest';
import {
  inboxThreadPickerConfig,
  renderThreadSearchTable,
} from '../../../../src/commands/inboxes/threads/utils';

const result = (): InboxThreadSearchResult => ({
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
});

describe('renderThreadSearchTable', () => {
  it('shows the matched email ID and no Match column', () => {
    const table = renderThreadSearchTable([result()]);
    expect(table).toContain('Matched email');
    expect(table).toContain('5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5');
    expect(table).not.toContain('Match ');
  });
});

describe('inboxThreadPickerConfig', () => {
  const display = inboxThreadPickerConfig(
    '78261eea-8f8b-4381-83c6-79fa7120f1cf',
  ).display;

  it('strips terminal control sequences from the subject', () => {
    const { label } = display({
      ...result(),
      subject: '\u001b[2J\u001b[31mFake prompt\u0007',
    });
    expect(label).toBe('Fake prompt');
  });

  it('shows (no subject) for an empty subject', () => {
    expect(display({ ...result(), subject: '' }).label).toBe('(no subject)');
  });

  it('shows (no subject) when the subject is only control sequences', () => {
    expect(display({ ...result(), subject: '\u001b[2J\u0007' }).label).toBe(
      '(no subject)',
    );
  });
});

describe('inboxThreadPickerConfig fetchItems', () => {
  it('lists the threads of an inbox email address', async () => {
    const list = vi.fn(async () => ({ data: null, error: null }));

    await inboxThreadPickerConfig('support@example.com').fetchItems(
      { inboxes: { threads: { list } } } as never,
      { limit: 5, after: 'cursor' },
    );

    expect(list.mock.calls[0]).toStrictEqual([
      { emailAddress: 'support@example.com', limit: 5, after: 'cursor' },
    ]);
  });
});
