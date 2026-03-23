import type { PickerConfig } from '../../lib/prompts';

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
