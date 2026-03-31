import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import {
  contactIdentifier,
  contactPickerConfig,
  renderContactTopicsTable,
} from './utils';

export const listContactTopicsCommand = new Command('topics')
  .description("List a contact's topic subscriptions")
  .argument('[id]', 'Contact UUID or email address')
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.

Topics control which broadcast email types a contact receives.
  subscription values: "opt_in" (receiving) | "opt_out" (not receiving)

Use "resend contacts update-topics <id>" to change subscription statuses.`,
      output: `  {"object":"list","data":[{"id":"...","name":"Product Updates","description":"...","subscription":"opt_in"}],"has_more":false}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend contacts topics e169aa45-1ecf-4183-9955-b1499d5701d3',
        'resend contacts topics steve.wozniak@gmail.com',
        'resend contacts topics e169aa45-1ecf-4183-9955-b1499d5701d3 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);
    // ListContactTopicsBaseOptions uses optional { id?, email? } (not a discriminated
    // union), so contactIdentifier's result is directly assignable without a cast.
    await runList(
      {
        loading: 'Fetching topic subscriptions...',
        sdkCall: (resend) => resend.contacts.topics.list(contactIdentifier(id)),
        onInteractive: (list) =>
          console.log(renderContactTopicsTable(list.data)),
      },
      globalOpts,
    );
  });
