import type { ContactProperty } from 'resend';
import { renderTable } from '../../lib/table';

export function renderContactPropertiesTable(props: ContactProperty[]): string {
  const rows = props.map((prop) => [
    prop.key,
    prop.type,
    prop.fallbackValue !== null && prop.fallbackValue !== undefined ? String(prop.fallbackValue) : '',
    prop.id,
    prop.createdAt,
  ]);
  return renderTable(['Key', 'Type', 'Fallback Value', 'ID', 'Created'], rows, '(no contact properties)');
}
