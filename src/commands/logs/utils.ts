import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export function renderLogsTable(
  logs: Array<{
    id: string;
    created_at: string;
    endpoint: string;
    method: string;
    response_status: number;
    user_agent: string | null;
  }>,
): string {
  const rows = logs.map((l) => [
    l.method,
    l.endpoint,
    String(l.response_status),
    l.created_at,
    l.id,
  ]);
  return renderTable(
    ['Method', 'Endpoint', 'Status', 'Created', 'ID'],
    rows,
    '(no logs)',
  );
}

export const logPickerConfig: PickerConfig<{
  id: string;
  endpoint: string;
  method: string;
}> = {
  resource: 'log',
  resourcePlural: 'logs',
  fetchItems: (resend, { limit, after }) =>
    resend.logs.list({ limit, ...(after && { after }) }),
  display: (l) => ({ label: `${l.method} ${l.endpoint}`, hint: l.id }),
};
