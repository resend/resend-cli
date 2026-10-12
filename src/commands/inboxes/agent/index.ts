import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { getInboxAgentCommand } from './get';
import { updateInboxAgentCommand } from './update';

export const inboxAgentCommand = new Command('agent')
  .description("Manage an inbox's agent settings")
  .addHelpText(
    'after',
    buildHelpText({
      context: `The agent settings set the instructions and the tone the inbox agent follows,
and which actions it is allowed to take.`,
      examples: [
        'resend inboxes agent get --inbox_id <inbox_id>',
        'resend inboxes agent update --inbox_id <inbox_id> --tone "friendly and concise"',
      ],
    }),
  )
  .addCommand(getInboxAgentCommand, { isDefault: true })
  .addCommand(updateInboxAgentCommand);
