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

function renderEmailsTable(emails: GetUsageResponseSuccess['emails']): string {
  const headers = ['Period', 'Used', 'Limit', 'Sent', 'Received', 'Resets At'];
  const rows = [
    [
      'daily',
      formatNumber(emails.daily.used),
      formatLimit(emails.daily.limit),
      formatNumber(emails.daily.sent),
      formatNumber(emails.daily.received),
      emails.daily.resets_at,
    ],
    [
      'monthly',
      formatNumber(emails.monthly.used),
      formatLimit(emails.monthly.limit),
      formatNumber(emails.monthly.sent),
      formatNumber(emails.monthly.received),
      emails.monthly.resets_at,
    ],
  ];
  return renderTable(headers, rows);
}

function renderResourcesTable(data: GetUsageResponseSuccess): string {
  const headers = ['Resource', 'Used', 'Limit'];
  const rows = [
    [
      'contacts',
      formatNumber(data.contacts.used),
      formatLimit(data.contacts.limit),
    ],
    [
      'segments',
      formatNumber(data.segments.used),
      formatLimit(data.segments.limit),
    ],
    [
      'broadcasts',
      formatNumber(data.broadcasts.used),
      formatLimit(data.broadcasts.limit),
    ],
    [
      'ai_credits',
      formatNumber(data.ai_credits.used),
      formatLimit(data.ai_credits.limit),
    ],
    [
      'automation_runs',
      formatNumber(data.automation_runs.used),
      formatLimit(data.automation_runs.limit),
    ],
    [
      'domains',
      formatNumber(data.domains.used),
      formatLimit(data.domains.limit),
    ],
  ];
  return renderTable(headers, rows);
}

function renderNotes(data: GetUsageResponseSuccess): string[] {
  const notes: string[] = [
    `automation_runs resets at ${data.automation_runs.resets_at}`,
  ];
  if (data.ai_credits.next_increase_at) {
    notes.push(
      `ai_credits next increase at ${data.ai_credits.next_increase_at}`,
    );
  }
  return notes;
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
          const notes = renderNotes(data);
          if (notes.length > 0) {
            console.log();
            for (const note of notes) {
              console.log(note);
            }
          }
          console.log();
          console.log(
            `Rate limit: ${formatNumber(data.rate_limit.limit)} requests / ${data.rate_limit.duration}`,
          );
        },
      },
      globalOpts,
    );
  });
