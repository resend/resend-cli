import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputResult } from '../../../lib/output';
import { withSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';

export const getAttachmentCommand = new Command('attachment')
  .description('Retrieve a single attachment from a received (inbound) email')
  .argument('<emailId>', 'Received email UUID')
  .argument('<attachmentId>', 'Attachment UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'The download_url is a signed URL that expires in ~1 hour. Download the file directly:\n  resend emails receiving attachment <emailId> <attachmentId> --json | jq -r .download_url | xargs curl -O',
      output:
        '  {"object":"attachment","id":"<uuid>","filename":"invoice.pdf","size":51200,"content_type":"application/pdf","content_disposition":"attachment","content_id":null,"download_url":"<signed-url>","expires_at":"<iso-date>"}',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend emails receiving attachment <email-id> <attachment-id>',
        'resend emails receiving attachment <email-id> <attachment-id> --json',
      ],
    }),
  )
  .action(async (emailId, attachmentId, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = await requireClient(globalOpts);

    const data = await withSpinner(
      'Fetching attachment...',
      () =>
        resend.emails.receiving.attachments.get({ emailId, id: attachmentId }),
      'fetch_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      const d = data;
      console.log(`${d.filename ?? '(unnamed)'}`);
      console.log(`ID:           ${d.id}`);
      console.log(`Content-Type: ${d.content_type}`);
      console.log(`Size:         ${d.size} bytes`);
      console.log(`Disposition:  ${d.content_disposition}`);
      console.log(`Download URL: ${d.download_url}`);
      console.log(`Expires:      ${d.expires_at}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
