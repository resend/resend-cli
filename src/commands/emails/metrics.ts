import { Command } from '@commander-js/extra-typings';
import type { EmailMetricsDataRow, EmailMetricsTotals } from 'resend';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { renderTable } from '../../lib/table';

function parseList(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function renderTotalsTable(totals: EmailMetricsTotals): string {
  const rows = Object.entries(totals).map(([metric, value]) => [
    metric,
    String(value),
  ]);
  return renderTable(['Metric', 'Value'], rows, '(no metrics)');
}

function renderBreakdownTable(
  data: EmailMetricsDataRow[],
  metrics: string[],
): string {
  const dimensionKeys = Object.keys(data[0] ?? {}).filter(
    (key) => !metrics.includes(key),
  );
  const headers = [...dimensionKeys, ...metrics];
  const rows = data.map((row) =>
    headers.map((key) => String(row[key as keyof EmailMetricsDataRow] ?? '')),
  );
  return renderTable(headers, rows, '(no breakdown rows)');
}

export const metricsCommand = new Command('metrics')
  .description('Retrieve account-level email metrics')
  .option(
    '--start-date <date>',
    'ISO 8601 date/datetime, defaults to 6 days before --end-date',
  )
  .option('--end-date <date>', 'ISO 8601 date/datetime, defaults to now')
  .option(
    '--timezone <tz>',
    'IANA timezone, e.g. America/New_York, defaults to UTC',
  )
  .option(
    '--granularity <granularity>',
    'Bucket size used when "period" is a dimension: hourly, daily, weekly, monthly',
  )
  .option(
    '--metrics <list>',
    'Comma-separated metrics to include, defaults to all',
  )
  .option(
    '--dimensions <list>',
    'Comma-separated dimensions to break down by: period, domain, email, broadcast',
  )
  .option('--domain-id <list>', 'Comma-separated sending domain IDs (max 100)')
  .option(
    '--email-id <list>',
    'Comma-separated email IDs (max 100). Cannot be combined with the "broadcast" dimension or --broadcast-id',
  )
  .option(
    '--broadcast-id <list>',
    'Comma-separated broadcast IDs (max 100). Cannot be combined with the "email" dimension or --email-id',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  {"object":"metrics","start_date":"...","end_date":"...","metrics":["sent","delivered"],"dimensions":[],"granularity":"daily","totals":{"sent":100,"delivered":95}}',
      errorCodes: ['auth_error', 'invalid_options', 'fetch_error'],
      examples: [
        'resend emails metrics',
        'resend emails metrics --start-date 2026-07-01 --end-date 2026-07-08',
        'resend emails metrics --dimensions period,broadcast --broadcast-id <broadcast-id>',
        'resend emails metrics --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const dimensions = parseList(opts.dimensions);
    const emailId = parseList(opts.emailId);
    const broadcastId = parseList(opts.broadcastId);

    const hasEmail =
      (dimensions?.includes('email') ?? false) || opts.emailId !== undefined;
    const hasBroadcast =
      (dimensions?.includes('broadcast') ?? false) ||
      opts.broadcastId !== undefined;

    if (hasEmail && hasBroadcast) {
      outputError(
        {
          message:
            'The "broadcast" dimension/--broadcast-id cannot be combined with the "email" dimension/--email-id.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    const metrics = parseList(opts.metrics);

    await runGet(
      {
        loading: 'Fetching email metrics...',
        sdkCall: (resend) =>
          resend.emails.metrics({
            startDate: opts.startDate,
            endDate: opts.endDate,
            timezone: opts.timezone,
            granularity: opts.granularity,
            metrics,
            dimensions,
            domainId: parseList(opts.domainId),
            emailId,
            broadcastId,
          } as Parameters<typeof resend.emails.metrics>[0]),
        onInteractive: (data) => {
          console.log(
            `Metrics for ${data.start_date} to ${data.end_date} (${data.granularity} granularity)`,
          );
          console.log();
          console.log('Totals:');
          console.log(renderTotalsTable(data.totals));
          if (data.data && data.data.length > 0) {
            console.log();
            console.log(`Breakdown by ${data.dimensions.join(', ')}:`);
            console.log(renderBreakdownTable(data.data, data.metrics));
          }
        },
      },
      globalOpts,
    );
  });
