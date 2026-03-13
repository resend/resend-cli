import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createTemplateCommand } from './create';
import { deleteTemplateCommand } from './delete';
import { duplicateTemplateCommand } from './duplicate';
import { getTemplateCommand } from './get';
import { listTemplatesCommand } from './list';
import { publishTemplateCommand } from './publish';
import { updateTemplateCommand } from './update';

export const templatesCommand = new Command('templates')
  .description('Manage templates — reusable email templates with variables')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Lifecycle:
  Templates follow a draft → published workflow:
    1. create    — creates a draft template
    2. update    — edits name, subject, HTML, variables, etc.
    3. publish   — promotes the draft to published status
    4. duplicate — copies an existing template as a new draft
  Published templates can be used in emails via template_id.
  After updating a published template, re-publish to make changes live.

Template variables:
  Variables use triple-brace syntax in HTML: {{{VAR_NAME}}}
  Each variable must be declared with --var when creating or updating:
    --var KEY:type            e.g. --var NAME:string
    --var KEY:type:fallback   e.g. --var PRICE:number:25
  Valid types: string, number.`,
      examples: [
        'resend templates list',
        'resend templates create --name "Welcome" --html "<h1>Hello {{{NAME}}}</h1>" --subject "Welcome!" --var NAME:string',
        'resend templates get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --subject "Updated Subject"',
        'resend templates publish 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates duplicate 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
      ],
    }),
  )
  .addCommand(createTemplateCommand)
  .addCommand(getTemplateCommand)
  .addCommand(listTemplatesCommand, { isDefault: true })
  .addCommand(updateTemplateCommand)
  .addCommand(deleteTemplateCommand)
  .addCommand(publishTemplateCommand)
  .addCommand(duplicateTemplateCommand);
