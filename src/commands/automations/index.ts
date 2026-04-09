import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createAutomationCommand } from './create';
import { deleteAutomationCommand } from './delete';
import { getAutomationCommand } from './get';
import { listAutomationsCommand } from './list';
import { automationRunsCommand } from './runs/index';
import { openAutomationCommand } from './open';
import { updateAutomationCommand } from './update';

export const automationsCommand = new Command('automations')
  .description('Manage automations')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Automations are event-driven workflows composed of steps and edges.

Steps define the actions (trigger, delay, send_email, wait_for_event, condition).
Edges define the flow between steps (default, condition_met, condition_not_met, timeout, event_received).

Lifecycle:
  1. resend automations create --name "Welcome" --file workflow.json
  2. resend automations update <id> --status enabled
  3. resend automations runs <id>                        (inspect runs)
  4. resend automations open <id>                        (view in dashboard)`,
      examples: [
        'resend automations list',
        'resend automations create --name "Welcome Flow" --file workflow.json',
        'resend automations get <id>',
        'resend automations update <id> --status enabled',
        'resend automations delete <id> --yes',
        'resend automations runs <automation-id>',
        'resend automations runs get --automation-id <id> --run-id <id>',
        'resend automations open <id>',
      ],
    }),
  )
  .addCommand(createAutomationCommand)
  .addCommand(getAutomationCommand)
  .addCommand(listAutomationsCommand, { isDefault: true })
  .addCommand(updateAutomationCommand)
  .addCommand(deleteAutomationCommand)
  .addCommand(openAutomationCommand)
  .addCommand(automationRunsCommand);
