import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { contactIdentifier } from './utils';

export const updateContactTopicsCommand = new Command('update-topics')
  .description("Update a contact's topic subscription statuses")
  .argument('<id>', 'Contact UUID or email address')
  .option(
    '--topics <json>',
    'JSON array of topic subscriptions (required) — e.g. \'[{"id":"topic-uuid","subscription":"opt_in"}]\''
  )
  .addHelpText(
    'after',
    `
The <id> argument accepts either a UUID or an email address.

Non-interactive: --topics is required.

Topics JSON format:
  '[{"id":"<topic-uuid>","subscription":"opt_in"}]'
  subscription values: "opt_in" | "opt_out"

This operation replaces all topic subscriptions for the specified topics.
Topics not included in the array are left unchanged.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"<contact-id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_topics | invalid_topics | update_topics_error

Examples:
  $ resend contacts update-topics 479e3145-dd38-4932-8c0c-e58b548c9e76 --topics '[{"id":"topic-uuid","subscription":"opt_in"}]'
  $ resend contacts update-topics user@example.com --topics '[{"id":"t1","subscription":"opt_out"},{"id":"t2","subscription":"opt_in"}]' --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let topicsJson = opts.topics;

    if (!topicsJson) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --topics flag.', code: 'missing_topics' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: "Topics JSON (e.g. '[{\"id\":\"topic-uuid\",\"subscription\":\"opt_in\"}]')",
        placeholder: '[{"id":"topic-uuid","subscription":"opt_in"}]',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      topicsJson = result;
    }

    let topics: Array<{ id: string; subscription: 'opt_in' | 'opt_out' }>;
    try {
      topics = JSON.parse(topicsJson);
      if (!Array.isArray(topics)) throw new Error('Not an array');
    } catch {
      outputError({ message: 'Invalid --topics JSON. Expected an array of {id, subscription} objects.', code: 'invalid_topics' }, { json: globalOpts.json });
    }

    const spinner = createSpinner('Updating topic subscriptions...', 'braille');

    try {
      // contactIdentifier's result is directly assignable: UpdateContactTopicsBaseOptions
      // uses optional { id?, email? } (not a discriminated union).
      const { data, error } = await resend.contacts.topics.update({ ...contactIdentifier(id), topics: topics! });

      if (error) {
        spinner.fail('Failed to update topic subscriptions');
        outputError({ message: error.message, code: 'update_topics_error' }, { json: globalOpts.json });
      }

      spinner.stop('Topic subscriptions updated');
      outputResult(data, { json: globalOpts.json });
    } catch (err) {
      spinner.fail('Failed to update topic subscriptions');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'update_topics_error' }, { json: globalOpts.json });
    }
  });
