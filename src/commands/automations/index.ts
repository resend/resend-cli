import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createAutomationCommand } from './create';
import { deleteAutomationCommand } from './delete';
import { getAutomationCommand } from './get';
import { listAutomationsCommand } from './list';
import { openAutomationCommand } from './open';
import { automationRunsCommand } from './runs/index';
import { stopAutomationCommand } from './stop';
import { updateAutomationCommand } from './update';

export const automationsCommand = new Command('automations')
  .description('Manage automations')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Automations are event-driven workflows composed of steps and connections.

Steps define the actions (trigger, delay, send_email, wait_for_event, condition).
Connections define the flow between steps (default, condition_met, condition_not_met, timeout, event_received).

Lifecycle:
  1. resend automations create --name "Welcome" --file workflow.json
  2. resend automations update <id> --status enabled
  3. resend automations stop <id>                        (stop automation)
  4. resend automations runs <id>                        (inspect runs)
  5. resend automations open <id>                        (view in dashboard)`,
      examples: [
        'resend automations list',
        'resend automations create --name "Welcome Flow" --file workflow.json',
        'resend automations get <id>',
        'resend automations update <id> --status enabled',
        'resend automations stop <id>',
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
  .addCommand(stopAutomationCommand)
  .addCommand(openAutomationCommand)
  .addCommand(automationRunsCommand);
