import type { ListReceivingEmail } from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { safeTerminalText } from '../../../lib/safe-terminal-text';
import { renderTable } from '../../../lib/table';

export const receivedEmailPickerConfig: PickerConfig<{
  id: string;
  subject: string;
}> = {
  resource: 'received email',
  resourcePlural: 'received emails',
  fetchItems: (resend, { limit, after }) =>
    resend.emails.receiving.list({ limit, ...(after && { after }) }),
  display: (e) => ({ label: e.subject || '(no subject)', hint: e.id }),
};

export function receivedAttachmentPickerConfig(
  emailId: string,
): PickerConfig<{ id: string; filename?: string }> {
  return {
    resource: 'attachment',
    resourcePlural: 'attachments',
    fetchItems: (resend, { limit, after }) =>
      resend.emails.receiving.attachments.list({
        emailId,
        limit,
        ...(after && { after }),
      }),
    display: (a) => ({ label: a.filename ?? '(unnamed)', hint: a.id }),
  };
}

export function renderReceivingEmailsTable(
  emails: ListReceivingEmail[],
): string {
  const rows = emails.map((e) => {
    const from = safeTerminalText(e.from);
    const to = e.to.map(safeTerminalText).join(', ');
    const toStr = to.length > 40 ? `${to.slice(0, 37)}...` : to;
    const rawSubject = safeTerminalText(e.subject);
    const subject =
      rawSubject.length > 50 ? `${rawSubject.slice(0, 47)}...` : rawSubject;
    return [from, toStr, subject, e.created_at, e.id];
  });
  return renderTable(
    ['From', 'To', 'Subject', 'Created At', 'ID'],
    rows,
    '(no received emails)',
  );
}
