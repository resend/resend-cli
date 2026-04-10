import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { attachmentPickerConfig, emailPickerConfig } from './utils';

export const getAttachmentCommand = new Command('attachment')
  .description('Retrieve a single attachment from a sent (outbound) email')
  .argument('[emailId]', 'Email UUID')
  .argument('[attachmentId]', 'Attachment UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'The download_url is a signed URL that expires in ~1 hour. Download the file directly:\n  resend emails attachment <emailId> <attachmentId> --json | jq -r .download_url | xargs curl -O',
      output:
        '  {"object":"attachment","id":"<uuid>","filename":"invoice.pdf","size":51200,"content_type":"application/pdf","content_disposition":"attachment","content_id":null,"download_url":"<signed-url>","expires_at":"<iso-date>"}',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend emails attachment <email-id> <attachment-id>',
        'resend emails attachment <email-id> <attachment-id> --json',
      ],
    }),
  )
  .action(async (emailIdArg, attachmentIdArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const emailId = await pickId(emailIdArg, emailPickerConfig, globalOpts);
    const attachmentId = await pickId(
      attachmentIdArg,
      attachmentPickerConfig(emailId),
      globalOpts,
    );
    await runGet(
      {
        loading: 'Fetching attachment...',
        sdkCall: (resend) =>
          resend.emails.attachments.get({ emailId, id: attachmentId }),
        onInteractive: (data) => {
          console.log(`${data.filename ?? '(unnamed)'}`);
          console.log(`ID:           ${data.id}`);
          console.log(`Content-Type: ${data.content_type}`);
          console.log(`Size:         ${data.size} bytes`);
          console.log(`Disposition:  ${data.content_disposition}`);
          console.log(`Download URL: ${data.download_url}`);
          console.log(`Expires:      ${data.expires_at}`);
        },
      },
      globalOpts,
    );
  });
