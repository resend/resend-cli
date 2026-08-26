import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { segmentContactsCommand } from './contacts';
import { createSegmentCommand } from './create';
import { deleteSegmentCommand } from './delete';
import { getSegmentCommand } from './get';
import { listSegmentsCommand } from './list';
import { updateSegmentCommand } from './update';

export const segmentsCommand = new Command('segments')
  .description('Manage segments')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Segments are the modern replacement for Audiences (deprecated).
A segment is a named group of contacts. Broadcasts target segments via segment_id.
Contacts can belong to multiple segments.

Segment membership is managed through the contacts namespace:
  resend contacts add-segment <contactId> --segment-id <segmentId>
  resend contacts remove-segment <contactId> <segmentId>
  resend contacts segments <contactId>`,
      examples: [
        'resend segments list',
        'resend segments create --name "Newsletter Subscribers"',
        'resend segments get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend segments update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Active Subscribers"',
        'resend segments contacts 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend segments delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
      ],
    }),
  )
  .addCommand(segmentContactsCommand)
  .addCommand(createSegmentCommand)
  .addCommand(getSegmentCommand)
  .addCommand(listSegmentsCommand, { isDefault: true })
  .addCommand(updateSegmentCommand)
  .addCommand(deleteSegmentCommand);
