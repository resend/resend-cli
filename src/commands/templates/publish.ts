import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const publishTemplateCommand = new Command('publish')
  .description('Publish a draft template')
  .argument('<id>', 'Template ID or alias')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Promotes a draft template to published status, making it available for use in emails.
After updating a published template, re-publish to make the changes live.
Publishing an already-published template re-publishes it with the latest draft changes.`,
      output: `  {"object":"template","id":"<template-id>"}`,
      errorCodes: ['auth_error', 'publish_error'],
      examples: [
        'resend templates publish 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates publish 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runWrite(
      {
        spinner: {
          loading: 'Publishing template...',
          success: 'Template published',
          fail: 'Failed to publish template',
        },
        sdkCall: (resend) => resend.templates.publish(id),
        errorCode: 'publish_error',
        successMsg: `\nTemplate published: ${id}`,
      },
      globalOpts,
    );
  });
