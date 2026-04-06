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
import { renderTable } from '../../../lib/table';
import { automationPickerConfig } from '../utils';

export const listAutomationRunsCommand = new Command('list')
  .alias('ls')
  .description('List runs for an automation')
  .argument('[automation-id]', 'Automation ID')
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
          }),
        onInteractive: (list) => {
          const rows = list.data.map((r) => [
            r.id,
            r.status,
            r.trigger?.event_name ?? '-',
            r.started_at ?? '-',
            r.completed_at ?? '-',
          ]);
          console.log(
            renderTable(
              ['ID', 'Status', 'Trigger', 'Started', 'Completed'],
              rows,
              '(no runs)',
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
