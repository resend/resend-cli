import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { segmentPickerConfig } from './utils';

export const getSegmentCommand = new Command('get')
  .description('Retrieve a segment by ID')
  .argument('[id]', 'Segment UUID')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"segment","id":"<uuid>","name":"<name>","created_at":"<iso-date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend segments get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend segments get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, segmentPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching segment...',
        sdkCall: (resend) => resend.segments.get(id),
        onInteractive: (data) => {
          console.log(`${data.name}`);
          console.log(`ID: ${data.id}`);
          console.log(`Created: ${data.created_at}`);
        },
      },
      globalOpts,
    );
  });
