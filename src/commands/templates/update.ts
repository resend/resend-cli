import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { parseVariables } from './utils';

export const updateTemplateCommand = new Command('update')
  .description('Update an existing template')
  .argument('<id>', 'Template ID or alias')
  .option('--name <name>', 'Update template name')
  .option('--html <html>', 'Update HTML body')
  .option(
    '--html-file <path>',
    'Path to an HTML file to replace the body (use "-" for stdin)',
  )
  .option('--subject <subject>', 'Update subject')
  .option('--text <text>', 'Update plain-text body')
  .option(
    '--text-file <path>',
    'Path to a plain-text file to replace the body (use "-" for stdin)',
  )
  .option('--from <address>', 'Update sender address')
  .option('--reply-to <address>', 'Update reply-to address')
  .option('--alias <alias>', 'Update template alias')
  .option(
    '--var <var...>',
    'Template variable: KEY:type or KEY:type:fallback (repeatable)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one option is required. Only the provided fields are changed; others are left as-is.

--var declares a template variable using the format KEY:type or KEY:type:fallback.
  Valid types: string, number.
  Variables must match {{{KEY}}} placeholders in the HTML body.`,
      output: `  {"object":"template","id":"<template-id>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'file_read_error',
        'invalid_options',
        'stdin_read_error',
        'update_error',
      ],
      examples: [
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Updated Name"',
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --html-file ./new-template.html',
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --subject "New Subject" --from "new@domain.com" --json',
        'resend templates update 78261eea-8f8b-4381-83c6-79fa7120f1cf --var PRODUCT:string:item --var PRICE:number:25',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (
      opts.name == null &&
      opts.html == null &&
      opts.htmlFile == null &&
      opts.subject == null &&
      opts.text == null &&
      opts.textFile == null &&
      opts.from == null &&
      opts.replyTo == null &&
      opts.alias == null &&
      opts.var == null
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --name, --html, --html-file, --subject, --text, --text-file, --from, --reply-to, --alias, or --var.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    if (opts.html && opts.htmlFile) {
      outputError(
        {
          message: '--html and --html-file are mutually exclusive.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    if (opts.htmlFile === '-' && opts.textFile === '-') {
      outputError(
        {
          message:
            'Cannot read both --html-file and --text-file from stdin. Pipe to one and pass the other as a file path.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    let html = opts.html;
    let text = opts.text;

    if (opts.htmlFile) {
      html = readFile(opts.htmlFile, globalOpts);
    }

    if (opts.textFile) {
      if (opts.text) {
        process.stderr.write(
          'Warning: both --text and --text-file provided; using --text-file\n',
        );
      }
      text = readFile(opts.textFile, globalOpts);
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
            ...(opts.name != null && { name: opts.name }),
            ...(html != null && { html }),
            ...(opts.subject != null && { subject: opts.subject }),
            ...(text != null && { text }),
            ...(opts.from != null && { from: opts.from }),
            ...(opts.replyTo != null && { replyTo: opts.replyTo }),
            ...(opts.alias != null && { alias: opts.alias }),
            ...(opts.var && { variables: parseVariables(opts.var) }),
          }),
        errorCode: 'update_error',
        successMsg: `\nTemplate updated: ${id}`,
      },
      globalOpts,
    );
  });
