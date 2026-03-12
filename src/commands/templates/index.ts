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
  Templates follow a draft → published flow:
    1. create    — creates a draft template
    2. publish   — promotes a draft to published status
  Published templates can be used in emails via template_id.

Template variables:
  HTML bodies support variable interpolation. Variables are automatically
  detected from the template content and shown in the template details.`,
      examples: [
        'resend templates list',
        'resend templates create --name "Welcome" --html "<h1>Hello {{name}}</h1>" --subject "Welcome!"',
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
