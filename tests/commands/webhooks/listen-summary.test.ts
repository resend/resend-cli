import { describe, expect, it } from 'vitest';
import { summarizeEvent } from '../../../src/commands/webhooks/listen';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const THREAD_ID = '3deaccfa-f572-443c-be6f-92b74f9d5c48';
const EMAIL_ID = '5e0e0b3c-9497-47d3-a527-4bd5e0e2f0f5';
const DRAFT_ID = 'a1f0c2d4-1b2c-4d5e-8f90-123456789abc';

describe('summarizeEvent', () => {
  it('shows sender and recipient for inbox email events', () => {
    const summary = summarizeEvent({
      type: 'inbox.email.received',
      data: {
        inbox_id: INBOX_ID,
        thread_id: THREAD_ID,
        email_id: EMAIL_ID,
        email: {
          id: EMAIL_ID,
          from: 'customer@example.com',
          to: ['support@acme.dev'],
        },
      },
    });

    expect(summary).toEqual({
      type: 'inbox.email.received',
      resourceId: EMAIL_ID,
      detail: 'customer@example.com -> support@acme.dev',
    });
  });

  it('shows the subject for inbox draft events', () => {
    const summary = summarizeEvent({
      type: 'inbox.draft.created',
      data: {
        inbox_id: INBOX_ID,
        draft_id: DRAFT_ID,
        draft: { id: DRAFT_ID, subject: 'Refund follow-up' },
      },
    });

    expect(summary.resourceId).toBe(DRAFT_ID);
    expect(summary.detail).toBe('Refund follow-up');
  });

  it('shows the subject for inbox thread events', () => {
    const summary = summarizeEvent({
      type: 'inbox.thread.folder.updated',
      data: {
        inbox_id: INBOX_ID,
        thread_id: THREAD_ID,
        thread: { id: THREAD_ID, subject: 'Billing question' },
      },
    });

    expect(summary.resourceId).toBe(THREAD_ID);
    expect(summary.detail).toBe('Billing question');
  });

  it('shows the address for inbox lifecycle events', () => {
    const summary = summarizeEvent({
      type: 'inbox.created',
      data: {
        inbox_id: INBOX_ID,
        inbox: { id: INBOX_ID, email_address: 'support@acme.dev' },
      },
    });

    expect(summary.resourceId).toBe(INBOX_ID);
    expect(summary.detail).toBe('support@acme.dev');
  });
});
