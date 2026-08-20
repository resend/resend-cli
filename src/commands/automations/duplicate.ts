import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { automationPickerConfig } from './utils';

export const duplicateAutomationCommand = new Command('duplicate')
  .description('Duplicate an automation')
  .argument('[id]', 'Automation ID to duplicate')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Creates a copy of an existing automation and returns the new automation ID.
The steps and connections are copied from the original.`,
      output: '  {"object":"automation","id":"<new-automation-id>"}',
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend automations duplicate <id>',
        'resend automations duplicate <id> --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, automationPickerConfig, globalOpts);
    await runCreate(
      {
        loading: 'Duplicating automation...',
        sdkCall: (resend) => resend.automations.duplicate(id),
        onInteractive: (d) => {
          console.log(`Automation duplicated: ${d.id}`);
        },
      },
      globalOpts,
    );
  });
