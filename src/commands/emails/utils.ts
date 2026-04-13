import type { ListAttachmentsResponseSuccess } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

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
