import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { cancelAndExit, requireText } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';
import { parsePropertiesJson } from './utils';

export const createContactCommand = new Command('create')
  .description('Create a new contact')
  .option('--email <email>', 'Contact email address (required)')
  .option('--first-name <name>', 'First name')
  .option('--last-name <name>', 'Last name')
  .option(
    '--unsubscribed',
    'Globally unsubscribe the contact from all broadcasts',
  )
  .option(
    '--properties <json>',
    'Custom properties as a JSON string (e.g. \'{"company":"Acme"}\')',
  )
  .option(
    '--segment-id <id...>',
    'Segment ID to add the contact to on creation (repeatable: --segment-id abc --segment-id def)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --email is required. All other flags are optional.

Properties: pass a JSON object string to --properties (e.g. '{"plan":"pro","company":"Acme"}').
  Properties are stored as custom contact attributes. To clear a property, set it to null.
  firstName and lastName are convenience aliases — they map to FIRST_NAME/LAST_NAME properties internally.

Segments: use --segment-id once per segment to add the contact to one or more segments on creation.

Unsubscribed: setting --unsubscribed is a team-wide opt-out from all broadcasts, regardless of segments/topics.`,
      output: `  {"object":"contact","id":"<id>"}`,
      errorCodes: [
        'auth_error',
        'missing_email',
        'invalid_properties',
        'create_error',
      ],
      examples: [
        'resend contacts create --email jane@example.com',
        'resend contacts create --email jane@example.com --first-name Jane --last-name Smith',
        'resend contacts create --email jane@example.com --unsubscribed',
        `resend contacts create --email jane@example.com --properties '{"company":"Acme","plan":"pro"}'`,
        'resend contacts create --email jane@example.com --segment-id seg_123 --segment-id seg_456',
        'resend contacts create --email jane@example.com --first-name Jane --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const email = await requireText(
      opts.email,
      { message: 'Email address', placeholder: 'user@example.com' },
      { message: 'Missing --email flag.', code: 'missing_email' },
      globalOpts,
    );

    let firstName = opts.firstName;
    let lastName = opts.lastName;

    if (isInteractive() && !opts.firstName) {
      const result = await p.text({
        message: 'First name (optional)',
        placeholder: 'Jane',
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      if (result) {
        firstName = result;
      }
    }

    if (isInteractive() && !opts.lastName) {
      const result = await p.text({
        message: 'Last name (optional)',
        placeholder: 'Smith',
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      if (result) {
        lastName = result;
      }
    }

    const properties = parsePropertiesJson(opts.properties, globalOpts);
    const segments = opts.segmentId ?? [];

    await runCreate(
      {
        spinner: {
          loading: 'Creating contact...',
          success: 'Contact created',
          fail: 'Failed to create contact',
        },
        sdkCall: (resend) =>
          resend.contacts.create({
            email,
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(opts.unsubscribed && { unsubscribed: true }),
            ...(properties && { properties }),
            ...(segments.length > 0 && {
              segments: segments.map((id) => ({ id })),
            }),
          }),
        onInteractive: (data) => {
          console.log(`\nContact created: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
