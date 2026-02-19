import { Command } from '@commander-js/extra-typings';
import type { RemoveContactSegmentOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { segmentContactIdentifier } from './utils';

export const removeContactSegmentCommand = new Command('remove-segment')
  .description('Remove a contact from a segment')
  .argument('<contactId>', 'Contact UUID or email address')
  .argument('<segmentId>', 'Segment ID to remove the contact from')
  .addHelpText(
    'after',
    `
The <contactId> argument accepts either a UUID or an email address.
The <segmentId> argument must be a segment UUID (not an email).

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"<segment-id>","deleted":true}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | remove_segment_error

Examples:
  $ resend contacts remove-segment 479e3145-dd38-4932-8c0c-e58b548c9e76 seg_123
  $ resend contacts remove-segment user@example.com seg_123 --json`
  )
  .action(async (contactId, segmentId, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Removing contact from segment...', 'braille');

    try {
      // segmentContactIdentifier resolves UUID vs email for the ContactSegmentsBaseOptions
      // discriminated union. The spread of that union requires an explicit cast.
      const payload = { ...segmentContactIdentifier(contactId), segmentId } as RemoveContactSegmentOptions;

      const { data, error } = await resend.contacts.segments.remove(payload);

      if (error) {
        spinner.fail('Failed to remove contact from segment');
        outputError({ message: error.message, code: 'remove_segment_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact removed from segment');
      outputResult(data, { json: globalOpts.json });
    } catch (err) {
      spinner.fail('Failed to remove contact from segment');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'remove_segment_error' }, { json: globalOpts.json });
    }
  });
