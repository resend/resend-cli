import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { broadcastStatusIndicator } from './utils';
import { buildHelpText } from '../../lib/help-text';

export const getBroadcastCommand = new Command('get')
  .description('Retrieve full details for a broadcast including HTML body, status, and delivery times')
  .argument('<id>', 'Broadcast ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: The list command returns summary objects without html/text/from/subject.
Use this command to retrieve the full broadcast payload.`,
      output: `  {"id":"...","object":"broadcast","name":"...","segment_id":"...","from":"...","subject":"...","status":"draft|queued|sent","created_at":"...","scheduled_at":null,"sent_at":null}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend broadcasts get bcast_123abc',
        'resend broadcasts get bcast_123abc --json',
      ],
    })
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const data = await withSpinner(
      { loading: 'Fetching broadcast...', success: 'Broadcast fetched', fail: 'Failed to fetch broadcast' },
      () => resend.broadcasts.get(id),
      'fetch_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      const b = data;
      console.log(`\nBroadcast: ${b.id}`);
      console.log(`  Status:      ${broadcastStatusIndicator(b.status)}`);
      console.log(`  Name:        ${b.name ?? '(untitled)'}`);
      console.log(`  From:        ${b.from ?? '—'}`);
      console.log(`  Subject:     ${b.subject ?? '—'}`);
      console.log(`  Segment:     ${b.segment_id ?? '—'}`);
      if (b.preview_text) console.log(`  Preview:     ${b.preview_text}`);
      if (b.topic_id) console.log(`  Topic:       ${b.topic_id}`);
      console.log(`  Created:     ${b.created_at}`);
      if (b.scheduled_at) console.log(`  Scheduled:   ${b.scheduled_at}`);
      if (b.sent_at) console.log(`  Sent:        ${b.sent_at}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
