import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const getSegmentCommand = new Command('get')
  .description('Retrieve a segment by ID')
  .argument('<id>', 'Segment UUID')
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
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const data = await withSpinner(
      { loading: 'Fetching segment...', success: 'Segment fetched', fail: 'Failed to fetch segment' },
      () => resend.segments.get(id),
      'fetch_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`\n${data.name}`);
      console.log(`ID: ${data.id}`);
      console.log(`Created: ${data.created_at}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
