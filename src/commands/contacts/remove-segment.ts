import { Command } from '@commander-js/extra-typings';
import type { RemoveContactSegmentOptions } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { segmentPickerConfig } from '../segments/utils';
import { contactPickerConfig, segmentContactIdentifier } from './utils';

export const removeContactSegmentCommand = new Command('remove-segment')
  .description('Remove a contact from a segment')
  .argument('[contactId]', 'Contact UUID or email address')
  .argument('[segmentId]', 'Segment ID to remove the contact from')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <contactId> argument accepts either a UUID or an email address.
The <segmentId> argument must be a segment UUID (not an email).`,
      output: `  {"id":"<segment-id>","deleted":true}`,
      errorCodes: ['auth_error', 'remove_segment_error'],
      examples: [
        'resend contacts remove-segment 479e3145-dd38-4932-8c0c-e58b548c9e76 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        'resend contacts remove-segment user@example.com 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --json',
      ],
    }),
  )
  .action(async (contactIdArg, segmentIdArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const contactId = await pickId(
      contactIdArg,
      contactPickerConfig,
      globalOpts,
    );
    const segmentId = await pickId(
      segmentIdArg,
      segmentPickerConfig,
      globalOpts,
    );

    // segmentContactIdentifier resolves UUID vs email for the ContactSegmentsBaseOptions
    // discriminated union. The spread of that union requires an explicit cast.
    const payload = {
      ...segmentContactIdentifier(contactId),
      segmentId,
    } as RemoveContactSegmentOptions;

    await runWrite(
      {
        spinner: {
          loading: 'Removing contact from segment...',
          success: 'Contact removed from segment',
          fail: 'Failed to remove contact from segment',
        },
        sdkCall: (resend) => resend.contacts.segments.remove(payload),
        errorCode: 'remove_segment_error',
        successMsg: `Contact removed from segment: ${segmentId}`,
      },
      globalOpts,
    );
  });
