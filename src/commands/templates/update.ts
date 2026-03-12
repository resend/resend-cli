import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';

export const updateTemplateCommand = new Command('update')
  .description('Update an existing template')
  .argument('<id>', 'Template ID or alias')
  .option('--name <name>', 'Update template name')
  .option('--html <html>', 'Update HTML body')
  .option('--html-file <path>', 'Path to an HTML file to replace the body')
  .option('--subject <subject>', 'Update subject')
  .option('--text <text>', 'Update plain-text body')
  .option('--from <address>', 'Update sender address')
  .option('--reply-to <address>', 'Update reply-to address')
  .option('--alias <alias>', 'Update template alias')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Provide at least one option to update. All options are optional but at least one must be given.`,
      output: `  {"object":"template","id":"<template-id>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'file_read_error',
        'update_error',
      ],
      examples: [
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Updated Name"',
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --html-file ./new-template.html',
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --subject "New Subject" --from "new@domain.com" --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (
      !opts.name &&
      !opts.html &&
      !opts.htmlFile &&
      !opts.subject &&
      !opts.text &&
      !opts.from &&
      !opts.replyTo &&
      !opts.alias
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --name, --html, --html-file, --subject, --text, --from, --reply-to, or --alias.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    let html = opts.html;

    if (opts.htmlFile) {
      html = readFile(opts.htmlFile, globalOpts);
    }

    await runWrite(
      {
        spinner: {
          loading: 'Updating template...',
          success: 'Template updated',
          fail: 'Failed to update template',
        },
        sdkCall: (resend) =>
          resend.templates.update(id, {
            ...(opts.name && { name: opts.name }),
            ...(html && { html }),
            ...(opts.subject && { subject: opts.subject }),
            ...(opts.text && { text: opts.text }),
            ...(opts.from && { from: opts.from }),
            ...(opts.replyTo && { replyTo: opts.replyTo }),
            ...(opts.alias && { alias: opts.alias }),
          }),
        errorCode: 'update_error',
        successMsg: `\nTemplate updated: ${id}`,
      },
      globalOpts,
    );
  });
