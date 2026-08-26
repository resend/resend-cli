import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId, requireText } from '../../lib/prompts';
import { segmentPickerConfig } from './utils';

export const updateSegmentCommand = new Command('update')
  .description('Rename a segment')
  .argument('[id]', 'Segment UUID')
  .option('--name <name>', 'New segment name')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY).`,
      output: `  {"object":"segment","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'missing_name', 'update_error'],
      examples: [
        'resend segments update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Active Subscribers"',
        'resend segments update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Active Subscribers" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, segmentPickerConfig, globalOpts);

    const name = await requireText(
      opts.name,
      {
        message: 'New segment name',
        placeholder: 'e.g. Active Subscribers',
        validate: (v) => {
          if (!v) {
            return 'Name is required';
          }
          return undefined;
        },
      },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    await runWrite(
      {
        loading: 'Updating segment...',
        sdkCall: (resend) => resend.segments.update(id, { name }),
        errorCode: 'update_error',
        successMsg: `Segment updated: ${id}`,
      },
      globalOpts,
    );
  });
