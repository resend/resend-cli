import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { renderSegmentsTable } from '../segments/utils';
import { contactPickerConfig, segmentContactIdentifier } from './utils';

export const listContactSegmentsCommand = new Command('segments')
  .description('List the segments a contact belongs to')
  .argument('[id]', 'Contact UUID or email address')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.`,
      output: `  {"object":"list","data":[{"id":"<segment-uuid>","name":"Newsletter Subscribers","created_at":"..."}],"has_more":false}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend contacts segments 479e3145-dd38-4932-8c0c-e58b548c9e76',
        'resend contacts segments user@example.com',
        'resend contacts segments 479e3145-dd38-4932-8c0c-e58b548c9e76 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);
    await runList(
      {
        spinner: {
          loading: 'Fetching segments...',
          success: 'Segments fetched',
          fail: 'Failed to list segments',
        },
        sdkCall: (resend) =>
          resend.contacts.segments.list(segmentContactIdentifier(id)),
        onInteractive: (list) => console.log(renderSegmentsTable(list.data)),
      },
      globalOpts,
    );
  });
