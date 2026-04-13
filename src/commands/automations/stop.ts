import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { automationPickerConfig } from './utils';

export const stopAutomationCommand = new Command('stop')
  .description('Stop a running automation')
  .argument('[id]', 'Automation ID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Stops a running automation by setting its status to disabled and cancelling active runs.',
      output: '  {"object":"automation","id":"<id>","status":"disabled"}',
      errorCodes: ['auth_error', 'stop_error'],
      examples: [
        'resend automations stop <id>',
        'resend automations stop <id> --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, automationPickerConfig, globalOpts);
    await runWrite(
      {
        loading: 'Stopping automation...',
        sdkCall: (resend) => resend.automations.stop(id),
        errorCode: 'stop_error',
        successMsg: 'Automation stopped',
      },
      globalOpts,
    );
  });
