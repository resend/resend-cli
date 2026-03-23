import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const apiKeyPickerConfig: PickerConfig<{
  id: string;
  name: string;
}> = {
  resource: 'API key',
  resourcePlural: 'API keys',
  fetchItems: (resend) =>
    resend.apiKeys.list().then((r) => ({
      ...r,
      data: r.data ? { data: r.data.data, has_more: false } : null,
    })),
  display: (k) => ({ label: k.name, hint: k.id }),
};

export function renderApiKeysTable(
  keys: Array<{
    id: string;
    name: string;
    created_at: string;
    last_used_at: string | null;
  }>,
): string {
  const rows = keys.map((k) => [
    k.name,
    k.id,
    k.created_at,
    k.last_used_at ?? '',
  ]);
  return renderTable(
    ['Name', 'ID', 'Created', 'Last used'],
    rows,
    '(no API keys)',
  );
}
