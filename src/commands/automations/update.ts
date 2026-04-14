import { Command, Option } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId, requireSelect } from '../../lib/prompts';
import { automationPickerConfig } from './utils';

export const updateAutomationCommand = new Command('update')
  .description('Update an automation status (enable or disable)')
  .argument('[id]', 'Automation ID')
  .addOption(
    new Option('--status <status>', 'New status').choices([
      'enabled',
      'disabled',
    ] as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"automation","id":"<id>","status":"<status>"}',
      errorCodes: ['auth_error', 'missing_status', 'update_error'],
      examples: [
        'resend automations update <id> --status enabled',
        'resend automations update <id> --status disabled --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, automationPickerConfig, globalOpts);

    const status = await requireSelect(
      opts.status,
      {
        message: 'Status',
        options: [
          { value: 'enabled' as const, label: 'Enabled' },
          { value: 'disabled' as const, label: 'Disabled' },
        ],
      },
      { message: 'Missing --status flag.', code: 'missing_status' },
      globalOpts,
    );

    await runWrite(
      {
        loading: 'Updating automation...',
        sdkCall: (resend) => resend.automations.update(id, { status }),
        errorCode: 'update_error',
        successMsg: `Automation updated: ${id} (${status})`,
      },
      globalOpts,
    );
  });
