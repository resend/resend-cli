import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../../lib/pagination';
import { requireText } from '../../../../lib/prompts';
import { renderTable } from '../../../../lib/table';

export const listAutomationRunStepsCommand = new Command('list')
  .alias('ls')
  .description('List steps for an automation run')
  .option('--automation-id <id>', 'Automation ID')
  .option('--run-id <id>', 'Run ID')
  .option('--limit <n>', 'Maximum number of steps to return (1-100)', '10')
  .option('--after <cursor>', 'Return steps after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return steps before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"list","data":[...],"has_more":true}',
      errorCodes: [
        'auth_error',
        'missing_automation_id',
        'missing_run_id',
        'invalid_limit',
        'list_error',
      ],
      examples: [
        'resend automations runs steps --automation-id <id> --run-id <id>',
        'resend automations runs steps list --automation-id <id> --run-id <id> --limit 25',
        'resend automations runs steps list --automation-id <id> --run-id <id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const automationId = await requireText(
      opts.automationId,
      { message: 'Automation ID' },
      {
        message: 'Missing --automation-id flag.',
        code: 'missing_automation_id',
      },
      globalOpts,
    );

    const runId = await requireText(
      opts.runId,
      { message: 'Run ID' },
      { message: 'Missing --run-id flag.', code: 'missing_run_id' },
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
        loading: 'Fetching run steps...',
        sdkCall: (resend) =>
          resend.automations.runs.steps.list({
            automationId,
            runId,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          const rows = list.data.map((s) => [
            s.id,
            s.type,
            s.status,
            s.started_at ?? '-',
            s.completed_at ?? '-',
          ]);
          console.log(
            renderTable(
              ['ID', 'Type', 'Status', 'Started', 'Completed'],
              rows,
              '(no steps)',
            ),
          );
          printPaginationHint(
            list,
            `automations runs steps list --automation-id ${automationId} --run-id ${runId}`,
            {
              limit,
              before: opts.before,
              apiKey: globalOpts.apiKey,
              profile: globalOpts.profile,
            },
          );
        },
      },
      globalOpts,
    );
  });
