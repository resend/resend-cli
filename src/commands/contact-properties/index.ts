import { Command } from '@commander-js/extra-typings';
import { createContactPropertyCommand } from './create';
import { getContactPropertyCommand } from './get';
import { listContactPropertiesCommand } from './list';
import { updateContactPropertyCommand } from './update';
import { deleteContactPropertyCommand } from './delete';

export const contactPropertiesCommand = new Command('contact-properties')
  .description('Manage contact property definitions — schema for custom data on contacts')
  .addHelpText(
    'after',
    `
Contact properties define the schema for custom data stored on contacts.
Think of them as column definitions — you create a property definition (e.g. company_name)
and then set values for that property on individual contacts via "resend contacts update --properties".

Property values are interpolated into broadcast HTML using triple-brace syntax:
  {{{PROPERTY_NAME|fallback}}}      — inline fallback if property value is absent
  {{{company_name|Unknown Company}}} — example: renders the company or "Unknown Company"

Reserved property keys (built-in, cannot be created): FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL

Supported types:
  string  — text values (default for most properties)
  number  — numeric values (useful for counts, scores, thresholds)

Note: property keys and types are immutable after creation. Only the fallback value can
be updated. Deleting a property removes it from all contacts.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Examples:
  $ resend contact-properties list
  $ resend contact-properties create --key company_name --type string
  $ resend contact-properties create --key plan --type string --fallback-value "free"
  $ resend contact-properties create --key score --type number --fallback-value 0
  $ resend contact-properties get prop_abc123
  $ resend contact-properties update prop_abc123 --fallback-value "Unknown"
  $ resend contact-properties update prop_abc123 --clear-fallback-value
  $ resend contact-properties delete prop_abc123 --yes`
  )
  .addCommand(createContactPropertyCommand)
  .addCommand(getContactPropertyCommand)
  .addCommand(listContactPropertiesCommand)
  .addCommand(updateContactPropertyCommand)
  .addCommand(deleteContactPropertyCommand);
