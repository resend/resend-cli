import { Command } from '@commander-js/extra-typings';
import type { RemoveContactSegmentOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { segmentContactIdentifier } from './utils';

export const removeContactSegmentCommand = new Command('remove-segment')
  .description('Remove a contact from a segment')
  .argument('<contactId>', 'Contact UUID or email address')
  .argument('<segmentId>', 'Segment ID to remove the contact from')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <contactId> argument accepts either a UUID or an email address.
The <segmentId> argument must be a segment UUID (not an email).`,
      output: `  {"id":"<segment-id>","deleted":true}`,
      errorCodes: ['auth_error', 'remove_segment_error'],
      examples: [
        'resend contacts remove-segment 479e3145-dd38-4932-8c0c-e58b548c9e76 seg_123',
        'resend contacts remove-segment user@example.com seg_123 --json',
      ],
    }),
  )
  .action(async (contactId, segmentId, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    // segmentContactIdentifier resolves UUID vs email for the ContactSegmentsBaseOptions
    // discriminated union. The spread of that union requires an explicit cast.
    const payload = { ...segmentContactIdentifier(contactId), segmentId } as RemoveContactSegmentOptions;

    const data = await withSpinner(
      { loading: 'Removing contact from segment...', success: 'Contact removed from segment', fail: 'Failed to remove contact from segment' },
      () => resend.contacts.segments.remove(payload),
      'remove_segment_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`Contact removed from segment: ${segmentId}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
