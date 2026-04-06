import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { getAutomationRunCommand } from './get';
import { listAutomationRunsCommand } from './list';
import { automationRunStepsCommand } from './steps/index';

export const automationRunsCommand = new Command('runs')
  .description('Manage automation runs')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Runs represent individual executions of an automation.
Each run is triggered by an event and progresses through the automation's steps.

Run status values: running | completed | failed | cancelled`,
      examples: [
        'resend automations runs <automation-id>',
        'resend automations runs list <automation-id> --limit 25',
        'resend automations runs get --automation-id <id> --run-id <id>',
        'resend automations runs steps list --automation-id <id> --run-id <id>',
        'resend automations runs steps get --automation-id <id> --run-id <id> --step-id <id>',
      ],
    }),
  )
  .addCommand(listAutomationRunsCommand, { isDefault: true })
  .addCommand(getAutomationRunCommand)
  .addCommand(automationRunStepsCommand);
