import type { DomainRecords } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';
import { isUnicodeSupported } from '../../lib/tty';

const h = isUnicodeSupported ? String.fromCodePoint(0x2500) : '-';

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
  return renderTable(['Name', 'Status', 'Region', 'ID'], rows, '(no domains)');
}

export function statusIndicator(status: string): string {
  switch (status) {
    case 'verified':
      return '✓ Verified';
    case 'pending':
      return '⏳ Pending';
    case 'not_started':
      return '○ Not started';
    case 'partially_verified':
      return '◐ Partially verified';
    case 'partially_failed':
      return '◐ Partially failed';
    case 'failed':
    case 'temporary_failure':
      return '✗ Failed';
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
