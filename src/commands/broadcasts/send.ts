import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { sendBroadcastPickerConfig } from './utils';

export const sendBroadcastCommand = new Command('send')
  .description(
    'Send a draft broadcast (API-created drafts only — dashboard broadcasts cannot be sent via API)',
  )
  .argument('[id]', 'Broadcast ID')
  .option(
    '--scheduled-at <datetime>',
    'Schedule delivery — ISO 8601 or natural language e.g. "in 1 hour", "tomorrow at 9am ET"',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: Only broadcasts created via the API can be sent via this command.
Broadcasts created in the Resend dashboard cannot be sent programmatically.

Scheduling:
  --scheduled-at accepts ISO 8601 (e.g. 2026-08-05T11:52:01Z) or
  natural language (e.g. "in 1 hour", "tomorrow at 9am ET").`,
      output: `  {"id":"<broadcast-id>"}`,
      errorCodes: ['auth_error', 'send_error'],
      examples: [
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --scheduled-at "in 1 hour"',
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --scheduled-at "2026-08-05T11:52:01Z" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, sendBroadcastPickerConfig, globalOpts);

    const successMsg = opts.scheduledAt
      ? `\nBroadcast scheduled: ${id}`
      : `\nBroadcast sent: ${id}`;

    await runWrite(
      {
        spinner: {
          loading: opts.scheduledAt
            ? 'Scheduling broadcast...'
            : 'Sending broadcast...',
          success: opts.scheduledAt ? 'Broadcast scheduled' : 'Broadcast sent',
          fail: 'Failed to send broadcast',
        },
        sdkCall: (resend) =>
          resend.broadcasts.send(id, {
            ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
          }),
        errorCode: 'send_error',
        successMsg,
        permission: 'sending_access',
      },
      globalOpts,
    );
  });
