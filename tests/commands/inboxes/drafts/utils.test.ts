import type { InboxDraftListItem } from 'resend';
import { describe, expect, it, vi } from 'vitest';
import { inboxDraftPickerConfig } from '../../../../src/commands/inboxes/drafts/utils';

const draft = (overrides: Partial<InboxDraftListItem>): InboxDraftListItem =>
  ({
    id: 'a1f0c2d4-1b2c-4d5e-8f90-123456789abc',
    type: 'standalone',
    to: ['user@example.com'],
    cc: [],
    bcc: [],
    subject: 'Hello',
    snippet: null,
    thread_id: null,
    reply_to_email_id: null,
    attachments: [],
    updated_at: '2026-09-24T14:12:08.000Z',
    ...overrides,
  }) as InboxDraftListItem;

describe('inboxDraftPickerConfig', () => {
  const display = inboxDraftPickerConfig(
    '78261eea-8f8b-4381-83c6-79fa7120f1cf',
  ).display;

  it('shows the recipients when the subject is empty', () => {
    expect(display(draft({ subject: '' })).label).toBe('user@example.com');
  });

  it('shows (no subject) when the subject and recipients are empty', () => {
    expect(display(draft({ subject: '', to: [] })).label).toBe('(no subject)');
  });
});

describe('inboxDraftPickerConfig fetchItems', () => {
  it('lists the drafts of an inbox email address', async () => {
    const list = vi.fn(async () => ({ data: null, error: null }));

    await inboxDraftPickerConfig('support@example.com').fetchItems(
      { inboxes: { drafts: { list } } } as never,
      { limit: 5 },
    );

    expect(list.mock.calls[0]).toStrictEqual([
      { emailAddress: 'support@example.com', limit: 5 },
    ]);
  });
});
