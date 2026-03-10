import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createSegmentCommand } from './create';
import { deleteSegmentCommand } from './delete';
import { getSegmentCommand } from './get';
import { listSegmentsCommand } from './list';

export const segmentsCommand = new Command('segments')
  .description(
    'Manage segments — named groups of contacts used to target broadcasts',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Segments are the modern replacement for Audiences (deprecated).
A segment is a named group of contacts. Broadcasts target segments via segment_id.
Contacts can belong to multiple segments.

Segment membership is managed through the contacts namespace:
  resend contacts add-segment <contactId> --segment-id <segmentId>
  resend contacts remove-segment <contactId> <segmentId>
  resend contacts segments <contactId>

There is no "update" endpoint — to rename a segment, delete it and recreate.`,
      examples: [
        'resend segments list',
        'resend segments create --name "Newsletter Subscribers"',
        'resend segments get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend segments delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
      ],
    }),
  )
  .addCommand(createSegmentCommand)
  .addCommand(getSegmentCommand)
  .addCommand(listSegmentsCommand, { isDefault: true })
  .addCommand(deleteSegmentCommand);
