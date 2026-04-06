import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../../lib/help-text';
import { getAutomationRunStepCommand } from './get';
import { listAutomationRunStepsCommand } from './list';

export const automationRunStepsCommand = new Command('steps')
  .description('Manage automation run steps')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Steps represent individual actions within an automation run.
Each step has a type (trigger, delay, send_email, wait_for_event, condition) and a status.

Step status values: pending | running | completed | failed | skipped | waiting`,
      examples: [
        'resend automations runs steps --automation-id <id> --run-id <id>',
        'resend automations runs steps list --automation-id <id> --run-id <id>',
        'resend automations runs steps get --automation-id <id> --run-id <id> --step-id <id>',
      ],
    }),
  )
  .addCommand(listAutomationRunStepsCommand, { isDefault: true })
  .addCommand(getAutomationRunStepCommand);
