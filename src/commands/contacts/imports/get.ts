import { Command } from '@commander-js/extra-typings';
import type { GetContactImportResponseSuccess } from 'resend';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { contactImportPickerConfig } from './utils';

export const getContactImportCommand = new Command('get')
  .description('Retrieve a contact import by ID')
  .argument('[id]', 'Contact import ID')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {\n    "object": "contact_import",\n    "id": "479e3145-dd38-476b-932c-529ceb705947",\n    "status": "completed",\n    "created_at": "2026-05-15T18:32:37.823Z",\n    "completed_at": "2026-05-15T18:33:42.916Z",\n    "counts": {"total":1200,"created":800,"updated":300,"skipped":75,"failed":25}\n  }`,
      errorCodes: ['auth_error', 'fetch_error', 'not_found'],
      examples: [
        'resend contacts imports get 479e3145-dd38-476b-932c-529ceb705947',
        'resend contacts imports get 479e3145-dd38-476b-932c-529ceb705947 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactImportPickerConfig, globalOpts);
    await runGet<GetContactImportResponseSuccess>(
      {
        loading: 'Fetching contact import...',
        sdkCall: (resend) => resend.contacts.imports.get(id),
        onInteractive: (imp) => {
          console.log(`${imp.id} - ${imp.status}`);
          console.log(`Created: ${imp.created_at}`);
          if (imp.completed_at) {
            console.log(`Completed: ${imp.completed_at}`);
          }
          const c = imp.counts;
          console.log(
            `Counts: ${c.total} total, ${c.created} created, ${c.updated} updated, ${c.skipped} skipped, ${c.failed} failed`,
          );
        },
      },
      globalOpts,
    );
  });
