import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';

export const updateBroadcastCommand = new Command('update')
  .description(
    'Update a draft broadcast — only drafts can be updated; sent broadcasts are immutable',
  )
  .argument('<id>', 'Broadcast ID')
  .option('--from <address>', 'Update sender address')
  .option('--subject <subject>', 'Update subject')
  .option(
    '--html <html>',
    'Update HTML body (supports {{{FIRST_NAME|fallback}}} variable interpolation)',
  )
  .option(
    '--html-file <path>',
    'Path to an HTML file to replace the body (supports {{{FIRST_NAME|fallback}}} variable interpolation)',
  )
  .option('--text <text>', 'Update plain-text body')
  .option('--name <name>', 'Update internal label')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: Only draft broadcasts can be updated.
If the broadcast is already sent or sending, the API will return an error.

Variable interpolation:
  HTML bodies support triple-brace syntax for contact properties.
  Example: {{{FIRST_NAME|Friend}}} — uses FIRST_NAME or falls back to "Friend".`,
      output: `  {"id":"<broadcast-id>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'file_read_error',
        'update_error',
      ],
      examples: [
        'resend broadcasts update d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --subject "Updated Subject"',
        'resend broadcasts update d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --html-file ./new-email.html',
        'resend broadcasts update d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --name "Q1 Newsletter" --from "news@domain.com" --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (
      !opts.from &&
      !opts.subject &&
      !opts.html &&
      !opts.htmlFile &&
      !opts.text &&
      !opts.name
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --from, --subject, --html, --html-file, --text, or --name.',
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
          loading: 'Updating broadcast...',
          success: 'Broadcast updated',
          fail: 'Failed to update broadcast',
        },
        sdkCall: (resend) =>
          resend.broadcasts.update(id, {
            ...(opts.from && { from: opts.from }),
            ...(opts.subject && { subject: opts.subject }),
            ...(html && { html }),
            ...(opts.text && { text: opts.text }),
            ...(opts.name && { name: opts.name }),
          }),
        errorCode: 'update_error',
        successMsg: `\nBroadcast updated: ${id}`,
      },
      globalOpts,
    );
  });
