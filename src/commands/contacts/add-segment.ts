import { Command } from '@commander-js/extra-typings';
import type { AddContactSegmentOptions } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { segmentPickerConfig } from '../segments/utils';
import { contactPickerConfig, segmentContactIdentifier } from './utils';

export const addContactSegmentCommand = new Command('add-segment')
  .description('Add a contact to a segment')
  .argument('[contactId]', 'Contact UUID or email address')
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
  .action(async (contactIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const contactId = await pickId(
      contactIdArg,
      contactPickerConfig,
      globalOpts,
    );
    const segmentId = await pickId(
      opts.segmentId,
      segmentPickerConfig,
      globalOpts,
    );

    // segmentContactIdentifier resolves UUID vs email for the ContactSegmentsBaseOptions
    // discriminated union. The spread of that union requires an explicit cast.
    const payload = {
      ...segmentContactIdentifier(contactId),
      segmentId,
    } as AddContactSegmentOptions;

    await runWrite(
      {
        spinner: {
          loading: 'Adding contact to segment...',
          success: 'Contact added to segment',
          fail: 'Failed to add contact to segment',
        },
        sdkCall: (resend) => resend.contacts.segments.add(payload),
        errorCode: 'add_segment_error',
        successMsg: `Contact added to segment: ${segmentId}`,
      },
      globalOpts,
    );
  });
