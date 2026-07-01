import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../lib/pagination';
import { pickId } from '../../../lib/prompts';
import { renderTable, type StatusTone } from '../../../lib/table';
import { isUnicodeSupported } from '../../../lib/tty';
import { automationPickerConfig } from '../utils';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const HOURGLASS = isUnicodeSupported ? String.fromCodePoint(0x23f3) : '~'; // ⏳
const CIRCLE = isUnicodeSupported ? String.fromCodePoint(0x25cb) : 'o'; // ○
const CROSS_MARK = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

function runStatusTone(status: string): StatusTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'pending';
    case 'failed':
      return 'failure';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function runStatusIndicator(status: string): string {
  switch (status) {
    case 'completed':
      return `${CHECK} Completed`;
    case 'running':
      return `${HOURGLASS} Running`;
    case 'failed':
      return `${CROSS_MARK} Failed`;
    case 'cancelled':
      return `${CIRCLE} Cancelled`;
    default:
      return status;
  }
}

export const listAutomationRunsCommand = new Command('list')
  .alias('ls')
  .description('List runs for an automation')
  .argument('[automation-id]', 'Automation ID')
  .option(
    '--status <status>',
    'Filter by status (running, completed, failed, cancelled). Comma-separated.',
  )
  .option('--limit <n>', 'Maximum number of runs to return (1-100)', '10')
  .option('--after <cursor>', 'Return runs after this cursor (next page)')
  .option('--before <cursor>', 'Return runs before this cursor (previous page)')
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"list","data":[...],"has_more":true}',
      errorCodes: ['auth_error', 'missing_id', 'invalid_limit', 'list_error'],
      examples: [
        'resend automations runs <automation-id>',
        'resend automations runs list <automation-id>',
        'resend automations runs list <automation-id> --status running',
        'resend automations runs list <automation-id> --limit 25 --json',
      ],
    }),
  )
  .action(async (automationIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const automationId = await pickId(
      automationIdArg,
      automationPickerConfig,
      globalOpts,
    );
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    await runList(
      {
        loading: 'Fetching automation runs...',
        sdkCall: (resend) =>
          resend.automations.runs.list({
            automationId,
            ...paginationOpts,
            ...(opts.status
              ? {
                  status: opts.status as Parameters<
                    typeof resend.automations.runs.list
                  >[0]['status'],
                }
              : {}),
          }),
        onInteractive: (list) => {
          const rows = list.data.map((r) => [
            r.id,
            runStatusIndicator(r.status),
            r.started_at ?? '-',
            r.completed_at ?? '-',
          ]);
          console.log(
            renderTable(
              ['ID', 'Status', 'Started', 'Completed'],
              rows,
              '(no runs)',
              {
                statusColumn: {
                  index: 1,
                  tones: list.data.map((r) => runStatusTone(r.status)),
                },
              },
            ),
          );
          printPaginationHint(list, `automations runs list ${automationId}`, {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
          });
        },
      },
      globalOpts,
    );
  });
