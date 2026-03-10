import { Command, Option } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';

export const createTopicCommand = new Command('create')
  .description('Create a new topic for subscription management')
  .option('--name <name>', 'Topic name (required)')
  .option(
    '--description <description>',
    'Description shown to contacts when managing subscriptions',
  )
  .addOption(
    new Option(
      '--default-subscription <mode>',
      'Default subscription state for contacts',
    )
      .choices(['opt_in', 'opt_out'] as const)
      .default('opt_in' as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Topics enable fine-grained subscription management. Contacts can opt in or out of
individual topics. Broadcasts can target only contacts opted into a specific topic.

Example topics: "Product Updates", "Security Alerts", "Weekly Digest".

--default-subscription controls what happens for contacts with no explicit subscription:
  opt_in   Contacts receive broadcasts unless they explicitly opt out (default)
  opt_out  Contacts do NOT receive broadcasts unless they explicitly opt in

Non-interactive: --name is required.`,
      output: `  {"id":"<uuid>"}`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend topics create --name "Product Updates"',
        'resend topics create --name "Weekly Digest" --default-subscription opt_out',
        'resend topics create --name "Security Alerts" --description "Critical security notices" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const name = await requireText(
      opts.name,
      { message: 'Topic name', placeholder: 'Product Updates' },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    await runCreate(
      {
        spinner: {
          loading: 'Creating topic...',
          success: 'Topic created',
          fail: 'Failed to create topic',
        },
        sdkCall: (resend) =>
          resend.topics.create({
            name,
            defaultSubscription: opts.defaultSubscription,
            ...(opts.description && { description: opts.description }),
          }),
        onInteractive: (data) => {
          console.log(`\nTopic created: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
