import type {
  ListAttachmentsResponseSuccess,
  ListReceivingEmail,
} from 'resend';
import { renderTable } from '../../../lib/formatters';

export function renderReceivingEmailsTable(
  emails: ListReceivingEmail[],
): string {
  const rows = emails.map((e) => {
    const to = e.to.join(', ');
    const toStr = to.length > 40 ? `${to.slice(0, 37)}...` : to;
    const subject =
      e.subject.length > 50 ? `${e.subject.slice(0, 47)}...` : e.subject;
    return [e.from, toStr, subject, e.created_at, e.id];
  });
  return renderTable(
    ['From', 'To', 'Subject', 'Created At', 'ID'],
    rows,
    '(no received emails)',
  );
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
