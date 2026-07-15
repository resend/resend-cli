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

export const batchAddSuppressionsCommand = new Command('add')
  .description(
    'Suppress up to 100 email addresses from a JSON file in one request',
  )
  .option(
    '--file <path>',
    'Path to a JSON file containing an array of email strings (use "-" for stdin; required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --file
Limit: 100 emails per request (API hard limit — warned if exceeded)

File format (--file path):
  ["spam@example.com", "bounce@example.com"]`,
      output: `  {"data":[{"object":"suppression","id":"<id>"}]}`,
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'stdin_read_error',
        'invalid_json',
        'invalid_format',
        'create_error',
      ],
      examples: [
        'resend suppressions batch add --file ./emails.json',
        'echo \'["a@example.com","b@example.com"]\' | resend suppressions batch add --file -',
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
          'Missing --file flag. Provide a JSON file with an array of email strings.',
        code: 'missing_file',
      },
      globalOpts,
    );

    const raw = readFile(filePath, globalOpts);
    const emails = readEmailList(raw, globalOpts);

    if (emails.length > 100) {
      console.warn(
        `Warning: ${emails.length} emails exceeds the 100-email limit. The API may reject this request.`,
      );
    }

    const data = await withSpinner(
      'Suppressing addresses...',
      () => resend.suppressions.batch.add({ emails }),
      'create_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(
        `Suppressed ${data.data.length} address${data.data.length === 1 ? '' : 'es'}`,
      );
      for (const entry of data.data) {
        console.log(`  ${entry.id}`);
      }
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
