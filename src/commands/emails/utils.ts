import type { ListAttachmentsResponseSuccess } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable, type StatusTone } from '../../lib/table';
import { isUnicodeSupported } from '../../lib/tty';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const HOURGLASS = isUnicodeSupported ? String.fromCodePoint(0x23f3) : '~'; // ⏳
const CIRCLE = isUnicodeSupported ? String.fromCodePoint(0x25cb) : 'o'; // ○
const CROSS_MARK = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

export function lastEventTone(lastEvent: string | null): StatusTone {
  switch (lastEvent) {
    case 'delivered':
    case 'opened':
    case 'clicked':
      return 'success';
    case 'sent':
    case 'queued':
    case 'delivery_delayed':
      return 'pending';
    case 'bounced':
    case 'complained':
      return 'failure';
    default:
      return 'neutral';
  }
}

export function lastEventIndicator(lastEvent: string | null): string {
  switch (lastEvent) {
    case 'delivered':
      return `${CHECK} Delivered`;
    case 'opened':
      return `${CHECK} Opened`;
    case 'clicked':
      return `${CHECK} Clicked`;
    case 'sent':
      return `${HOURGLASS} Sent`;
    case 'queued':
      return `${HOURGLASS} Queued`;
    case 'delivery_delayed':
      return `${HOURGLASS} Delayed`;
    case 'bounced':
      return `${CROSS_MARK} Bounced`;
    case 'complained':
      return `${CROSS_MARK} Complained`;
    default:
      return `${CIRCLE} —`;
  }
}

export const emailPickerConfig: PickerConfig<{
  id: string;
  subject: string;
}> = {
  resource: 'email',
  resourcePlural: 'emails',
  fetchItems: (resend, { limit, after }) =>
    resend.emails.list({ limit, ...(after && { after }) }),
  display: (e) => ({ label: e.subject || '(no subject)', hint: e.id }),
};

export function attachmentPickerConfig(
  emailId: string,
): PickerConfig<{ id: string; filename?: string }> {
  return {
    resource: 'attachment',
    resourcePlural: 'attachments',
    fetchItems: (resend, { limit, after }) =>
      resend.emails.attachments.list({
        emailId,
        limit,
        ...(after && { after }),
      }),
    display: (a) => ({ label: a.filename ?? '(unnamed)', hint: a.id }),
  };
}

export function renderAttachmentsTable(
  attachments: ListAttachmentsResponseSuccess['data'],
): string {
  const rows = attachments.map((a) => [
    a.filename ?? '(unnamed)',
    a.content_type,
    String(a.size),
    a.id,
  ]);
  return renderTable(
    ['Filename', 'Content-Type', 'Size (bytes)', 'ID'],
    rows,
    '(no attachments)',
  );
}
