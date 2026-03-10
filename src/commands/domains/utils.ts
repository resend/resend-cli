import type { DomainRecords } from 'resend';
import { renderTable } from '../../lib/table';

export function renderDnsRecordsTable(
  records: DomainRecords[],
  domainName: string,
): string {
  const rows = records.map((r) => {
    const displayName = r.name
      ? r.name.includes('.')
        ? r.name
        : `${r.name}.${domainName}`
      : domainName;
    return [r.type, displayName, r.ttl, r.value];
  });
  return renderTable(
    ['Type', 'Name', 'TTL', 'Value'],
    rows,
    '(no DNS records)',
  );
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
    case 'failed':
    case 'temporary_failure':
      return '✗ Failed';
    default:
      return status;
  }
}
