import { describe, expect, it } from 'vitest';
import { renderDnsRecordsTable } from '../../../src/commands/domains/utils';

describe('renderDnsRecordsTable', () => {
  it('returns empty message when no records', () => {
    expect(renderDnsRecordsTable([], 'example.com')).toBe('(no DNS records)');
  });

  it('renders a card per record with type separator', () => {
    const output = renderDnsRecordsTable(
      [
        {
          record: 'SPF',
          type: 'MX',
          name: 'send',
          ttl: 'Auto',
          status: 'verified',
          value: 'feedback-smtp.us-east-1.amazonses.com',
          priority: 10,
        },
      ],
      'example.com',
    );

    expect(output).toContain('MX');
    expect(output).toContain('Name   send.example.com');
    expect(output).toContain('TTL    Auto');
    expect(output).toContain('Value  feedback-smtp.us-east-1.amazonses.com');
  });

  it('expands short name with domain suffix', () => {
    const output = renderDnsRecordsTable(
      [
        {
          record: 'DKIM',
          type: 'TXT',
          name: 'dkim',
          ttl: 'Auto',
          status: 'pending',
          value: 'p=MIIG...',
          priority: 0,
        },
      ],
      'send.example.com',
    );

    expect(output).toContain('Name   dkim.send.example.com');
  });

  it('keeps FQDN name as-is', () => {
    const output = renderDnsRecordsTable(
      [
        {
          record: 'SPF',
          type: 'TXT',
          name: 'send.example.com',
          ttl: 'Auto',
          status: 'verified',
          value: 'v=spf1 include:amazonses.com ~all',
          priority: 0,
        },
      ],
      'example.com',
    );

    expect(output).toContain('Name   send.example.com');
  });

  it('uses domain name when record name is empty', () => {
    const output = renderDnsRecordsTable(
      [
        {
          record: 'SPF',
          type: 'TXT',
          name: '',
          ttl: 'Auto',
          status: 'verified',
          value: 'v=spf1',
          priority: 0,
        },
      ],
      'example.com',
    );

    expect(output).toContain('Name   example.com');
  });

  it('renders a TrackingCAA record using domain name when record name is empty', () => {
    const output = renderDnsRecordsTable(
      [
        {
          record: 'TrackingCAA',
          type: 'CAA',
          name: '',
          ttl: 'Auto',
          status: 'verified',
          value: '0 issue "amazon.com"',
        },
      ],
      'example.com',
    );

    expect(output).toContain('CAA');
    expect(output).toContain('Name   example.com');
    expect(output).toContain('Value  0 issue "amazon.com"');
  });

  it('separates multiple records with blank line', () => {
    const output = renderDnsRecordsTable(
      [
        {
          record: 'SPF',
          type: 'MX',
          name: 'send',
          ttl: 'Auto',
          status: 'verified',
          value: 'mx.example.com',
          priority: 10,
        },
        {
          record: 'DKIM',
          type: 'TXT',
          name: 'resend._domainkey',
          ttl: 'Auto',
          status: 'pending',
          value: 'p=MIIG...',
          priority: 0,
        },
      ],
      'example.com',
    );

    const cards = output.split('\n\n');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('MX');
    expect(cards[1]).toContain('TXT');
  });
});
