import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { cancelBroadcastPickerConfig } from './utils';

export const cancelBroadcastCommand = new Command('cancel')
  .description('Cancel a queued or scheduled broadcast')
  .argument('[id]', 'Broadcast ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Only queued or scheduled broadcasts can be cancelled; draft and sent broadcasts cannot.
Cancelling a scheduled broadcast stops the scheduled delivery. Cancelling a queued
broadcast stops it mid-send — emails already sent are not affected.`,
      output: `  {"object":"broadcast","id":"<id>"}`,
      errorCodes: ['auth_error', 'cancel_error'],
      examples: [
        'resend broadcasts cancel d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts cancel d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, cancelBroadcastPickerConfig, globalOpts);

    await runWrite(
      {
        loading: 'Cancelling broadcast...',
        sdkCall: (resend) => resend.broadcasts.cancel(id),
        errorCode: 'cancel_error',
        successMsg: 'Broadcast cancelled',
        permission: 'sending_access',
      },
      globalOpts,
    );
  });
