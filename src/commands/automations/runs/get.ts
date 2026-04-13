import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { requireText } from '../../../lib/prompts';

export const getAutomationRunCommand = new Command('get')
  .description('Retrieve details of a specific automation run')
  .option('--automation-id <id>', 'Automation ID')
  .option('--run-id <id>', 'Run ID')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  Full automation run object with status, trigger, and timestamps.',
      errorCodes: [
        'auth_error',
        'missing_automation_id',
        'missing_run_id',
        'fetch_error',
      ],
      examples: [
        'resend automations runs get --automation-id <id> --run-id <id>',
        'resend automations runs get --automation-id <id> --run-id <id> --json',
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

    await runGet(
      {
        loading: 'Fetching automation run...',
        sdkCall: (resend) =>
          resend.automations.runs.get({ automationId, runId }),
        onInteractive: (r) => {
          console.log(`Run: ${r.id}`);
          console.log(`Status: ${r.status}`);
          if (r.started_at) {
            console.log(`Started: ${r.started_at}`);
          }
          if (r.completed_at) {
            console.log(`Completed: ${r.completed_at}`);
          }
          console.log(`Created: ${r.created_at}`);
        },
      },
      globalOpts,
    );
  });
