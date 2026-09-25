import { Command } from '@commander-js/extra-typings';
import type { GetUsageResponseSuccess } from 'resend';
import { runGet } from '../lib/actions';
import type { GlobalOpts } from '../lib/client';
import { buildHelpText } from '../lib/help-text';
import { renderTable } from '../lib/table';

function formatLimit(limit: number | null): string {
  return limit === null ? '—' : String(limit);
}

function renderEmailsTable(emails: GetUsageResponseSuccess['emails']): string {
  const headers = ['Period', 'Used', 'Limit', 'Sent', 'Received', 'Resets At'];
  const rows = [
    [
      'daily',
      String(emails.daily.used),
      formatLimit(emails.daily.limit),
      String(emails.daily.sent),
      String(emails.daily.received),
      emails.daily.resets_at,
    ],
    [
      'monthly',
      String(emails.monthly.used),
      formatLimit(emails.monthly.limit),
      String(emails.monthly.sent),
      String(emails.monthly.received),
      emails.monthly.resets_at,
    ],
  ];
  return renderTable(headers, rows);
}

function renderResourcesTable(data: GetUsageResponseSuccess): string {
  const headers = ['Resource', 'Used', 'Limit', 'Notes'];
  const rows = [
    [
      'contacts',
      String(data.contacts.used),
      formatLimit(data.contacts.limit),
      '',
    ],
    [
      'segments',
      String(data.segments.used),
      formatLimit(data.segments.limit),
      '',
    ],
    [
      'broadcasts',
      String(data.broadcasts.used),
      formatLimit(data.broadcasts.limit),
      '',
    ],
    [
      'ai_credits',
      String(data.ai_credits.used),
      formatLimit(data.ai_credits.limit),
      data.ai_credits.next_increase_at
        ? `next increase ${data.ai_credits.next_increase_at}`
        : '',
    ],
    [
      'automation_runs',
      String(data.automation_runs.used),
      formatLimit(data.automation_runs.limit),
      `resets ${data.automation_runs.resets_at}`,
    ],
    ['domains', String(data.domains.used), formatLimit(data.domains.limit), ''],
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
          console.log('Emails:');
          console.log(renderEmailsTable(data.emails));
          console.log();
          console.log('Other resources:');
          console.log(renderResourcesTable(data));
          console.log();
          console.log(
            `Rate limit: ${data.rate_limit.limit} requests / ${data.rate_limit.duration}`,
          );
        },
      },
      globalOpts,
    );
  });
