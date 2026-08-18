import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { type CareersListResponse, renderCareersTable } from './utils';

export const listCareersCommand = new Command('list')
  .description('List open positions at Resend')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Lists open positions, fetched live from our applicant tracking system.',
      output: `  {"object":"list","data":[{"id":"<id>","title":"<title>","department":"<department>","team":"<team>","location":"<location>","employment_type":"<type>","workplace_type":"<type>","published_at":"<date>"}]}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend careers',
        'resend careers list --json',
        'resend careers apply <id>',
      ],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    await runList<CareersListResponse>(
      {
        loading: 'Fetching open positions...',
        sdkCall: (resend) => resend.get<CareersListResponse>('/careers'),
        permission: 'sending_access',
        onInteractive: (result) => {
          console.log(renderCareersTable(result.data));
          if (result.data.length > 0) {
            console.log('\nApply with: resend careers apply <id>');
          }
        },
      },
      globalOpts,
    );
  });
