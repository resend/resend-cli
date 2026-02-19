import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { AddContactSegmentOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { segmentContactIdentifier } from './utils';

export const addContactSegmentCommand = new Command('add-segment')
  .description('Add a contact to a segment')
  .argument('<contactId>', 'Contact UUID or email address')
  .option('--segment-id <id>', 'Segment ID to add the contact to (required)')
  .addHelpText(
    'after',
    `
The <contactId> argument accepts either a UUID or an email address.

Non-interactive: --segment-id is required.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"<segment-membership-id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_segment_id | add_segment_error

Examples:
  $ resend contacts add-segment 479e3145-dd38-4932-8c0c-e58b548c9e76 --segment-id seg_123
  $ resend contacts add-segment user@example.com --segment-id seg_123 --json`
  )
  .action(async (contactId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let segmentId = opts.segmentId;

    if (!segmentId) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --segment-id flag.', code: 'missing_segment_id' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: 'Segment ID',
        placeholder: 'seg_123',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      segmentId = result;
    }

    const spinner = createSpinner('Adding contact to segment...', 'braille');

    try {
      // segmentContactIdentifier resolves UUID vs email for the ContactSegmentsBaseOptions
      // discriminated union. The spread of that union requires an explicit cast.
      const payload = { ...segmentContactIdentifier(contactId), segmentId } as AddContactSegmentOptions;

      const { data, error } = await resend.contacts.segments.add(payload);

      if (error) {
        spinner.fail('Failed to add contact to segment');
        outputError({ message: error.message, code: 'add_segment_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact added to segment');
      outputResult(data, { json: globalOpts.json });
    } catch (err) {
      spinner.fail('Failed to add contact to segment');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'add_segment_error' }, { json: globalOpts.json });
    }
  });
