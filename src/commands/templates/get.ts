import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { templatePickerConfig } from './utils';

export const getTemplateCommand = new Command('get')
  .description('Retrieve a template by ID or alias')
  .argument('[id]', 'Template ID or alias')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Returns the full template including HTML body, variables, and publication status.`,
      output: `  {"object":"template","id":"...","name":"...","subject":"...","status":"draft|published","html":"...","alias":"...","from":"...","reply_to":["..."],"variables":[...],"created_at":"...","updated_at":"..."}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend templates get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates get my-template-alias',
        'resend templates get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, templatePickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching template...',
        sdkCall: (resend) => resend.templates.get(id),
        onInteractive: (data) => {
          console.log(`${data.name}`);
          console.log(`ID: ${data.id}`);
          console.log(`Status: ${data.status}`);
          if (data.alias) {
            console.log(`Alias: ${data.alias}`);
          }
          if (data.subject) {
            console.log(`Subject: ${data.subject}`);
          }
          if (data.from) {
            console.log(`From: ${data.from}`);
          }
          if (data.reply_to?.length) {
            console.log(`Reply-To: ${data.reply_to.join(', ')}`);
          }
          if (data.html) {
            const snippet =
              data.html.length > 200
                ? `${data.html.slice(0, 197)}...`
                : data.html;
            console.log(`HTML: ${snippet}`);
          }
          if (data.variables?.length) {
            console.log(
              `Variables: ${data.variables.map((v) => v.key).join(', ')}`,
            );
          }
          if (data.published_at) {
            console.log(`Published: ${data.published_at}`);
          }
          console.log(`Created: ${data.created_at}`);
          console.log(`Updated: ${data.updated_at}`);
        },
      },
      globalOpts,
    );
  });
