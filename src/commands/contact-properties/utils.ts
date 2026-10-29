import type { ContactProperty } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const contactPropertyPickerConfig: PickerConfig<{
  id: string;
  key: string;
  type: string;
}> = {
  resource: 'contact property',
  resourcePlural: 'contact properties',
  fetchItems: (resend, { limit, after }) =>
    resend.contactProperties.list({ limit, ...(after && { after }) }),
  display: (p) => ({ label: `${p.key} (${p.type})`, hint: p.id }),
};

export function renderContactPropertiesTable(props: ContactProperty[]): string {
  const rows = props.map((prop) => [
    prop.key,
    prop.type,
    prop.fallbackValue != null ? String(prop.fallbackValue) : '',
    prop.id,
    prop.createdAt,
  ]);
  return renderTable(
    ['Key', 'Type', 'Fallback Value', 'ID', 'Created'],
    rows,
    '(no contact properties)',
  );
}

// parseFloat accepts any numeric prefix ("1,000" is 1, "12abc" is 12), so a
// typo would be saved as a different number. Require the whole string to be
// a finite number instead.
export function parseNumberFallback(raw: string): number | undefined {
  if (raw.trim() === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
