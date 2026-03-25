import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { cancelAndExit, pickId } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import {
  contactIdentifier,
  contactPickerConfig,
  parseTopicsJson,
} from './utils';

export const updateContactTopicsCommand = new Command('update-topics')
  .description("Update a contact's topic subscription statuses")
  .argument('[id]', 'Contact UUID or email address')
  .option(
    '--topics <json>',
    'JSON array of topic subscriptions (required) — e.g. \'[{"id":"topic-uuid","subscription":"opt_in"}]\'',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.

Non-interactive: --topics is required.

Topics JSON format:
  '[{"id":"<topic-uuid>","subscription":"opt_in"}]'
  subscription values: "opt_in" | "opt_out"

This operation replaces all topic subscriptions for the specified topics.
Topics not included in the array are left unchanged.`,
      output: `  {"id":"<contact-id>"}`,
      errorCodes: [
        'auth_error',
        'missing_topics',
        'invalid_topics',
        'update_topics_error',
      ],
      examples: [
        `resend contacts update-topics e169aa45-1ecf-4183-9955-b1499d5701d3 --topics '[{"id":"b6d24b8e-af0b-4c3c-be0c-359bbd97381e","subscription":"opt_in"}]'`,
        `resend contacts update-topics steve.wozniak@gmail.com --topics '[{"id":"b6d24b8e-af0b-4c3c-be0c-359bbd97381e","subscription":"opt_out"},{"id":"07d84122-7224-4881-9c31-1c048e204602","subscription":"opt_in"}]' --json`,
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);
    const resend = await requireClient(globalOpts);

    let topicsJson = opts.topics;

    if (!topicsJson) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --topics flag.', code: 'missing_topics' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message:
          'Topics JSON (e.g. \'[{"id":"topic-uuid","subscription":"opt_in"}]\')',
        placeholder: '[{"id":"topic-uuid","subscription":"opt_in"}]',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      topicsJson = result;
    }

    const topics = parseTopicsJson(topicsJson, globalOpts);

    // contactIdentifier's result is directly assignable: UpdateContactTopicsBaseOptions
    // uses optional { id?, email? } (not a discriminated union).
    const data = await withSpinner(
      {
        loading: 'Updating topic subscriptions...',
        success: 'Topic subscriptions updated',
        fail: 'Failed to update topic subscriptions',
      },
      () => resend.contacts.topics.update({ ...contactIdentifier(id), topics }),
      'update_topics_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`Topic subscriptions updated for contact: ${id}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
