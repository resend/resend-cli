import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { AddContactSegmentOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import { segmentContactIdentifier } from './utils';

export const addContactSegmentCommand = new Command('add-segment')
  .description('Add a contact to a segment')
  .argument('<contactId>', 'Contact UUID or email address')
  .option('--segment-id <id>', 'Segment ID to add the contact to (required)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <contactId> argument accepts either a UUID or an email address.

Non-interactive: --segment-id is required.`,
      output: `  {"id":"<segment-membership-id>"}`,
      errorCodes: ['auth_error', 'missing_segment_id', 'add_segment_error'],
      examples: [
        'resend contacts add-segment 479e3145-dd38-4932-8c0c-e58b548c9e76 --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        'resend contacts add-segment user@example.com --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --json',
      ],
    }),
  )
  .action(async (contactId, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = await requireClient(globalOpts);

    let segmentId = opts.segmentId;

    if (!segmentId) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --segment-id flag.', code: 'missing_segment_id' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Segment ID',
        placeholder: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      segmentId = result;
    }

    // segmentContactIdentifier resolves UUID vs email for the ContactSegmentsBaseOptions
    // discriminated union. The spread of that union requires an explicit cast.
    const payload = {
      ...segmentContactIdentifier(contactId),
      segmentId,
    } as AddContactSegmentOptions;

    const data = await withSpinner(
      {
        loading: 'Adding contact to segment...',
        success: 'Contact added to segment',
        fail: 'Failed to add contact to segment',
      },
      () => resend.contacts.segments.add(payload),
      'add_segment_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`Contact added to segment: ${segmentId}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
