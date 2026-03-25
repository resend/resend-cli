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
        'resend contacts add-segment e169aa45-1ecf-4183-9955-b1499d5701d3 --segment-id 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend contacts add-segment steve.wozniak@gmail.com --segment-id 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
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
