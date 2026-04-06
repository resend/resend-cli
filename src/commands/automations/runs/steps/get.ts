import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { requireText } from '../../../../lib/prompts';

export const getAutomationRunStepCommand = new Command('get')
  .description('Retrieve details of a specific automation run step')
  .option('--automation-id <id>', 'Automation ID')
  .option('--run-id <id>', 'Run ID')
  .option('--step-id <id>', 'Step ID')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  Full automation run step object with type, config, status, and timestamps.\n\nStep status values: pending | running | completed | failed | skipped | waiting',
      errorCodes: [
        'auth_error',
        'missing_automation_id',
        'missing_run_id',
        'missing_step_id',
        'fetch_error',
      ],
      examples: [
        'resend automations runs steps get --automation-id <id> --run-id <id> --step-id <id>',
        'resend automations runs steps get --automation-id <id> --run-id <id> --step-id <id> --json',
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

    const stepId = await requireText(
      opts.stepId,
      { message: 'Step ID' },
      { message: 'Missing --step-id flag.', code: 'missing_step_id' },
      globalOpts,
    );

    await runGet(
      {
        loading: 'Fetching run step...',
        sdkCall: (resend) =>
          resend.automations.runs.steps.get({
            automationId,
            runId,
            stepId,
          }),
        onInteractive: (s) => {
          console.log(`Step: ${s.id}`);
          console.log(`Step ID: ${s.step_id}`);
          console.log(`Type: ${s.type}`);
          console.log(`Status: ${s.status}`);
          if (Object.keys(s.config).length > 0) {
            console.log(`Config: ${JSON.stringify(s.config, null, 2)}`);
          }
          if (s.started_at) {
            console.log(`Started: ${s.started_at}`);
          }
          if (s.completed_at) {
            console.log(`Completed: ${s.completed_at}`);
          }
          console.log(`Created: ${s.created_at}`);
        },
      },
      globalOpts,
    );
  });
