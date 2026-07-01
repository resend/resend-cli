import type { DomainRecords } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable, type StatusTone } from '../../lib/table';
import { isUnicodeSupported } from '../../lib/tty';

const h = isUnicodeSupported ? String.fromCodePoint(0x2500) : '-';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const HOURGLASS = isUnicodeSupported ? String.fromCodePoint(0x23f3) : '~'; // ⏳
const CIRCLE = isUnicodeSupported ? String.fromCodePoint(0x25cb) : 'o'; // ○
const HALF_CIRCLE = isUnicodeSupported ? String.fromCodePoint(0x25d0) : '~'; // ◐
const CROSS_MARK = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

function domainStatusTone(status: string): StatusTone {
  switch (status) {
    case 'verified':
      return 'success';
    case 'pending':
    case 'partially_verified':
    case 'partially_failed':
      return 'pending';
    case 'not_started':
      return 'neutral';
    case 'failed':
    case 'temporary_failure':
      return 'failure';
    default:
      return 'neutral';
  }
}

export function renderDnsRecordsTable(
  records: DomainRecords[],
  domainName: string,
): string {
  if (records.length === 0) {
    return '(no DNS records)';
  }

  const cards = records.map((r) => {
    const displayName = r.name
      ? r.name.includes('.')
        ? r.name
        : `${r.name}.${domainName}`
      : domainName;

    const separator = `${h}${h} ${r.type} ${h.repeat(40)}`;
    return [
      separator,
      `  Name   ${displayName}`,
      `  TTL    ${r.ttl}`,
      `  Value  ${r.value}`,
    ].join('\n');
  });

  return cards.join('\n\n');
}

export function renderDomainsTable(
  domains: Array<{ id: string; name: string; status: string; region: string }>,
): string {
  const rows = domains.map((d) => [d.name, d.status, d.region, d.id]);
  return renderTable(['Name', 'Status', 'Region', 'ID'], rows, '(no domains)', {
    statusColumn: {
      index: 1,
      tones: domains.map((d) => domainStatusTone(d.status)),
    },
  });
}

export function statusIndicator(status: string): string {
  switch (status) {
    case 'verified':
      return `${CHECK} Verified`;
    case 'pending':
      return `${HOURGLASS} Pending`;
    case 'not_started':
      return `${CIRCLE} Not started`;
    case 'partially_verified':
      return `${HALF_CIRCLE} Partially verified`;
    case 'partially_failed':
      return `${HALF_CIRCLE} Partially failed`;
    case 'failed':
    case 'temporary_failure':
      return `${CROSS_MARK} Failed`;
    default:
      return status;
  }
}

export const domainPickerConfig: PickerConfig<{
  id: string;
  name: string;
}> = {
  resource: 'domain',
  resourcePlural: 'domains',
  fetchItems: (resend, { limit, after }) =>
    resend.domains.list({ limit, ...(after && { after }) }),
  display: (d) => ({ label: d.name, hint: d.id }),
};
