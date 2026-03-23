import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { broadcastPickerConfig, broadcastStatusIndicator } from './utils';

export const getBroadcastCommand = new Command('get')
  .description(
    'Retrieve full details for a broadcast including HTML body, status, and delivery times',
  )
  .argument('[id]', 'Broadcast ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: The list command returns summary objects without html/text/from/subject.
Use this command to retrieve the full broadcast payload.`,
      output: `  {"id":"...","object":"broadcast","name":"...","segment_id":"...","from":"...","subject":"...","status":"draft|queued|sent","created_at":"...","scheduled_at":null,"sent_at":null}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend broadcasts get d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts get d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, broadcastPickerConfig, globalOpts);
    await runGet(
      {
        spinner: {
          loading: 'Fetching broadcast...',
          success: 'Broadcast fetched',
          fail: 'Failed to fetch broadcast',
        },
        sdkCall: (resend) => resend.broadcasts.get(id),
        onInteractive: (b) => {
          console.log(`\nBroadcast: ${b.id}`);
          console.log(`  Status:      ${broadcastStatusIndicator(b.status)}`);
          console.log(`  Name:        ${b.name ?? '(untitled)'}`);
          console.log(`  From:        ${b.from ?? '—'}`);
          console.log(`  Subject:     ${b.subject ?? '—'}`);
          console.log(`  Segment:     ${b.segment_id ?? '—'}`);
          if (b.preview_text) {
            console.log(`  Preview:     ${b.preview_text}`);
          }
          if (b.topic_id) {
            console.log(`  Topic:       ${b.topic_id}`);
          }
          console.log(`  Created:     ${b.created_at}`);
          if (b.scheduled_at) {
            console.log(`  Scheduled:   ${b.scheduled_at}`);
          }
          if (b.sent_at) {
            console.log(`  Sent:        ${b.sent_at}`);
          }
        },
      },
      globalOpts,
    );
  });
