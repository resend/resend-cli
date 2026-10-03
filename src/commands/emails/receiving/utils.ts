import type { ListReceivingEmail } from 'resend';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';
import { truncate } from '../../../lib/truncate';

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
    const to = e.to.join(', ');
    const toStr = truncate(to, 40);
    const subject = truncate(e.subject, 50);
    return [e.from, toStr, subject, e.created_at, e.id];
  });
  return renderTable(
    ['From', 'To', 'Subject', 'Created At', 'ID'],
    rows,
    '(no received emails)',
  );
}
