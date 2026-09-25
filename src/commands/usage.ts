import { Command } from '@commander-js/extra-typings';
import type { GetUsageResponseSuccess } from 'resend';
import { runGet } from '../lib/actions';
import type { GlobalOpts } from '../lib/client';
import { buildHelpText } from '../lib/help-text';
import { renderTable } from '../lib/table';

const numberFormat = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function formatLimit(limit: number | null): string {
  return limit === null ? '—' : formatNumber(limit);
}

function renderUsageTable(data: GetUsageResponseSuccess): string {
  const headers = [
    'Resource',
    'Used',
    'Limit',
    'Sent',
    'Received',
    'Resets At',
  ];
  const rows = [
    [
      'emails_daily',
      formatNumber(data.emails.daily.used),
      formatLimit(data.emails.daily.limit),
      formatNumber(data.emails.daily.sent),
      formatNumber(data.emails.daily.received),
      data.emails.daily.resets_at,
    ],
    [
      'emails_monthly',
      formatNumber(data.emails.monthly.used),
      formatLimit(data.emails.monthly.limit),
      formatNumber(data.emails.monthly.sent),
      formatNumber(data.emails.monthly.received),
      data.emails.monthly.resets_at,
    ],
    [
      'contacts',
      formatNumber(data.contacts.used),
      formatLimit(data.contacts.limit),
      '',
      '',
      '',
    ],
    [
      'segments',
      formatNumber(data.segments.used),
      formatLimit(data.segments.limit),
      '',
      '',
      '',
    ],
    [
      'broadcasts',
      formatNumber(data.broadcasts.used),
      formatLimit(data.broadcasts.limit),
      '',
      '',
      '',
    ],
    [
      'ai_credits',
      formatNumber(data.ai_credits.used),
      formatLimit(data.ai_credits.limit),
      '',
      '',
      data.ai_credits.next_increase_at ?? '',
    ],
    [
      'automation_runs',
      formatNumber(data.automation_runs.used),
      formatLimit(data.automation_runs.limit),
      '',
      '',
      data.automation_runs.resets_at,
    ],
    [
      'domains',
      formatNumber(data.domains.used),
      formatLimit(data.domains.limit),
      '',
      '',
      '',
    ],
    [
      'rate_limit',
      '',
      `${formatNumber(data.rate_limit.limit)} / ${data.rate_limit.duration}`,
      '',
      '',
      '',
    ],
  ];
  return renderTable(headers, rows);
}

export const usageCommand = new Command('usage')
  .description('Show account-level usage and quota limits')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  {"object":"usage","emails":{"daily":{"used":258,"limit":null,"sent":57,"received":201,"resets_at":"..."},"monthly":{"used":5442,"limit":10000,"sent":1000,"received":4442,"resets_at":"..."}},"contacts":{"used":85000,"limit":150000},"segments":{"used":2,"limit":3},"broadcasts":{"used":100,"limit":null},"ai_credits":{"used":0,"limit":500,"next_increase_at":"..."},"automation_runs":{"used":0,"limit":1000,"resets_at":"..."},"domains":{"used":1,"limit":1000},"rate_limit":{"limit":10,"duration":"1000ms"}}',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: ['resend usage', 'resend usage --json'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    await runGet(
      {
        loading: 'Fetching usage...',
        sdkCall: (resend) => resend.usage.get(),
        onInteractive: (data) => {
          console.log(renderUsageTable(data));
        },
      },
      globalOpts,
    );
  });
