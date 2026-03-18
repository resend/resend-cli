import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';
import { parseVariables } from './utils';

export const createTemplateCommand = new Command('create')
  .description('Create a new template')
  .option('--name <name>', 'Template name — required')
  .option('--html <html>', 'HTML body')
  .option('--html-file <path>', 'Path to an HTML file for the body')
  .option('--subject <subject>', 'Email subject')
  .option('--text <text>', 'Plain-text body')
  .option('--from <address>', 'Sender address')
  .option('--reply-to <address>', 'Reply-to address')
  .option('--alias <alias>', 'Template alias for lookup by name')
  .option(
    '--var <var...>',
    'Template variable: KEY:type or KEY:type:fallback (repeatable)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Creates a new draft template. Use "resend templates publish" to make it available for sending.

--name is required. Body: provide --html or --html-file (mutually exclusive).

--var declares a template variable using the format KEY:type or KEY:type:fallback.
  Valid types: string, number.
  Variables must match {{{KEY}}} placeholders in the HTML body:
    --html "<p>Hi {{{NAME}}}, your total is {{{PRICE}}}</p>"
    --var NAME:string --var PRICE:number:0

Non-interactive: --name and a body (--html or --html-file) are required.`,
      output: `  {"object":"template","id":"<template-id>"}`,
      errorCodes: [
        'auth_error',
        'missing_name',
        'missing_body',
        'file_read_error',
        'create_error',
      ],
      examples: [
        'resend templates create --name "Welcome" --html "<h1>Hello</h1>" --subject "Welcome!"',
        'resend templates create --name "Newsletter" --html-file ./template.html --from hello@domain.com',
        'resend templates create --name "Onboarding" --html "<p>Hi</p>" --alias onboarding --json',
        'resend templates create --name "Order" --html "<p>{{{PRODUCT}}}: {{{PRICE}}}</p>" --var PRODUCT:string:item --var PRICE:number:25',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    let name = opts.name;

    if (!name) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --name flag.', code: 'missing_name' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Template name',
        placeholder: 'Welcome Email',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      name = result;
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

    let html = opts.html;

    if (opts.htmlFile) {
      html = readFile(opts.htmlFile, globalOpts);
    }

    if (!html) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          {
            message: 'Missing body. Provide --html or --html-file.',
            code: 'missing_body',
          },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'HTML body',
        placeholder: '<h1>Hello {{name}}</h1>',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      html = result;
    }

    await runCreate(
      {
        spinner: {
          loading: 'Creating template...',
          success: 'Template created',
          fail: 'Failed to create template',
        },
        sdkCall: (resend) =>
          Promise.resolve(
            resend.templates.create({
              name,
              html,
              ...(opts.subject && { subject: opts.subject }),
              ...(opts.text && { text: opts.text }),
              ...(opts.from && { from: opts.from }),
              ...(opts.replyTo && { replyTo: opts.replyTo }),
              ...(opts.alias && { alias: opts.alias }),
              ...(opts.var && { variables: parseVariables(opts.var) }),
            }),
          ),
        onInteractive: (d) => {
          console.log(`\nTemplate created: ${d.id}`);
        },
      },
      globalOpts,
    );
  });
