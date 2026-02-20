import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const createSegmentCommand = new Command('create')
  .description('Create a new segment')
  .option('--name <name>', 'Segment name (required)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Segments are named groups of contacts. Broadcasts target segments via segment_id.
Contacts can belong to multiple segments. Audiences are deprecated — use segments instead.

Non-interactive: --name is required.`,
      output: `  {"object":"segment","id":"<uuid>","name":"<name>"}`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend segments create --name "Newsletter Subscribers"',
        'resend segments create --name "Beta Users" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let name = opts.name;

    if (!name) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --name flag.', code: 'missing_name' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: 'Segment name',
        placeholder: 'Newsletter Subscribers',
        validate: (v) => (!v ? 'Name is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      name = result;
    }

    const data = await withSpinner(
      { loading: 'Creating segment...', success: 'Segment created', fail: 'Failed to create segment' },
      () => resend.segments.create({ name: name! }),
      'create_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`\nSegment created: ${data.id}`);
      console.log(`Name: ${data.name}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
