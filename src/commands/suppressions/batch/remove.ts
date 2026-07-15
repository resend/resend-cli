import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { readFile } from '../../../lib/files';
import { buildHelpText } from '../../../lib/help-text';
import { outputResult } from '../../../lib/output';
import { requireText } from '../../../lib/prompts';
import { withSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';
import { readEmailList } from './utils';

export const batchRemoveSuppressionsCommand = new Command('remove')
  .alias('rm')
  .description('Remove up to 100 suppressions from a JSON file in one request')
  .option(
    '--file <path>',
    'Path to a JSON file containing an array of email strings (use "-" for stdin; required in non-interactive mode)',
  )
  .option(
    '--ids',
    'Treat the file entries as suppression IDs instead of email addresses',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --file
Limit: 100 entries per request (API hard limit — warned if exceeded)
By default entries are treated as email addresses; pass --ids to remove by suppression ID.

File format (--file path):
  ["spam@example.com", "bounce@example.com"]`,
      output: `  {"data":[{"object":"suppression","id":"<id>","deleted":true}]}`,
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'stdin_read_error',
        'invalid_json',
        'invalid_format',
        'delete_error',
      ],
      examples: [
        'resend suppressions batch remove --file ./emails.json',
        'resend suppressions batch remove --file ./ids.json --ids',
        'echo \'["a@example.com","b@example.com"]\' | resend suppressions batch rm --file -',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = await requireClient(globalOpts);

    const filePath = await requireText(
      opts.file,
      { message: 'Path to JSON file', placeholder: './emails.json' },
      {
        message:
          'Missing --file flag. Provide a JSON file with an array of strings.',
        code: 'missing_file',
      },
      globalOpts,
    );

    const raw = readFile(filePath, globalOpts);
    const values = readEmailList(raw, globalOpts);

    if (values.length > 100) {
      console.warn(
        `Warning: ${values.length} entries exceeds the 100-entry limit. The API may reject this request.`,
      );
    }

    const data = await withSpinner(
      'Removing suppressions...',
      () =>
        resend.suppressions.batch.remove(
          opts.ids ? { ids: values } : { emails: values },
        ),
      'delete_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(
        `Removed ${data.data.length} suppression${data.data.length === 1 ? '' : 's'}`,
      );
      for (const entry of data.data) {
        console.log(`  ${entry.id}`);
      }
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
