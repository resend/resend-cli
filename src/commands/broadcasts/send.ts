import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import { isInteractive } from '../../lib/tty';
import { outputError, outputResult } from '../../lib/output';
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
  .option(
    '--dry-run',
    'Validate input and print the request JSON without calling the API',
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
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --dry-run',
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --scheduled-at "in 1 hour"',
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --scheduled-at "2026-08-05T11:52:01Z" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    let id = idArg;

    if (!id && opts.dryRun) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing required argument: id', code: 'missing_id' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Broadcast ID',
        placeholder: 'e.g. 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        validate: (value) => (value ? true : 'Required'),
      });
      if (p.isCancel(result)) {
        process.exit(0);
      }
      id = result;
    } else if (!id) {
      id = await pickId(idArg, sendBroadcastPickerConfig, globalOpts);
    }

    if (opts.dryRun) {
      outputResult(
        {
          dryRun: true,
          request: {
            id,
            ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
          },
        },
        { json: globalOpts.json },
      );
      return;
    }

    await runWrite(
      {
        loading: opts.scheduledAt
          ? 'Scheduling broadcast...'
          : 'Sending broadcast...',
        sdkCall: (resend) =>
          resend.broadcasts.send(id, {
            ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
          }),
        errorCode: 'send_error',
        successMsg: opts.scheduledAt ? 'Broadcast scheduled' : 'Broadcast sent',
        permission: 'sending_access',
      },
      globalOpts,
    );
  });
