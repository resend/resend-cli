import { Command } from '@commander-js/extra-typings';
import type { SendEventOptions } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { parseJsonFlag } from '../../lib/json';
import { outputError } from '../../lib/output';
import { requireSelect, requireText } from '../../lib/prompts';

export const sendEventCommand = new Command('send')
  .description('Send an event to trigger automations for a contact')
  .option('--event <name>', 'Event name (e.g. user.signed_up)')
  .option('--contact-id <id>', 'Contact ID (mutually exclusive with --email)')
  .option(
    '--email <email>',
    'Contact email (mutually exclusive with --contact-id)',
  )
  .option('--payload <json>', 'Event payload as JSON string')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Sends an event for a specific contact, triggering any automations listening for it.

Contact targeting:
  Provide exactly one of --contact-id or --email to identify the contact.
  These flags are mutually exclusive.

Payload:
  Optional JSON object with event-specific data.
  Must match the event's schema if one is defined.`,
      output: '  {"object":"event","event":"<name>"}',
      errorCodes: [
        'auth_error',
        'missing_event',
        'missing_contact',
        'conflicting_contact',
        'invalid_json',
        'send_error',
      ],
      examples: [
        'resend events send --event "user.signed_up" --contact-id <id>',
        'resend events send --event "user.signed_up" --email user@example.com',
        'resend events send --event "order.completed" --contact-id <id> --payload \'{"amount":99,"currency":"usd"}\'',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (opts.contactId !== undefined && opts.email !== undefined) {
      outputError(
        {
          message:
            'Cannot use both --contact-id and --email. Provide only one.',
          code: 'conflicting_contact',
        },
        { json: globalOpts.json },
      );
    }

    const event = await requireText(
      opts.event,
      { message: 'Event name', placeholder: 'e.g. user.signed_up' },
      { message: 'Missing --event flag.', code: 'missing_event' },
      globalOpts,
    );

    let contactId = opts.contactId;
    let email = opts.email;

    if (!contactId && !email) {
      const method = await requireSelect(
        undefined,
        {
          message: 'Identify contact by',
          options: [
            { value: 'contact-id' as const, label: 'Contact ID' },
            { value: 'email' as const, label: 'Email address' },
          ],
        },
        {
          message: 'Missing --contact-id or --email flag.',
          code: 'missing_contact',
        },
        globalOpts,
      );

      if (method === 'contact-id') {
        contactId = await requireText(
          undefined,
          { message: 'Contact ID' },
          { message: 'Missing contact ID.', code: 'missing_contact' },
          globalOpts,
        );
      } else {
        email = await requireText(
          undefined,
          { message: 'Email address', placeholder: 'user@example.com' },
          { message: 'Missing email.', code: 'missing_contact' },
          globalOpts,
        );
      }
    }

    const payload = parseJsonFlag(opts.payload, '--payload', globalOpts) as
      | Record<string, unknown>
      | undefined;

    const sdkPayload: SendEventOptions = contactId
      ? { event, contactId, ...(payload && { payload }) }
      : { event, email: email as string, ...(payload && { payload }) };

    await runWrite(
      {
        loading: 'Sending event...',
        sdkCall: (resend) => resend.events.send(sdkPayload),
        errorCode: 'send_error',
        successMsg: `Event sent: ${event}`,
      },
      globalOpts,
    );
  });
