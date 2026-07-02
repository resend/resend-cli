import type { PickerConfig } from '../../lib/prompts';
import { renderTable, type StatusTone } from '../../lib/table';
import { isUnicodeSupported } from '../../lib/tty';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const HOURGLASS = isUnicodeSupported ? String.fromCodePoint(0x23f3) : '~'; // ⏳
const CROSS_MARK = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

function httpStatusTone(status: number): StatusTone {
  if (status < 300) {
    return 'success';
  }
  if (status < 400) {
    return 'pending';
  }
  return 'failure';
}

function httpStatusIndicator(status: number): string {
  if (status < 300) {
    return `${CHECK} ${status}`;
  }
  if (status < 400) {
    return `${HOURGLASS} ${status}`;
  }
  return `${CROSS_MARK} ${status}`;
}

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
    httpStatusIndicator(l.response_status),
    l.created_at,
    l.id,
  ]);
  return renderTable(
    ['Method', 'Endpoint', 'Status', 'Created', 'ID'],
    rows,
    '(no logs)',
    {
      statusColumn: {
        index: 2,
        tones: logs.map((l) => httpStatusTone(l.response_status)),
      },
    },
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
