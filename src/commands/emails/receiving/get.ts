import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { withSpinner } from '../../../lib/spinner';
import { outputResult } from '../../../lib/output';
import { isInteractive } from '../../../lib/tty';
import { buildHelpText } from '../../../lib/help-text';

export const getReceivingCommand = new Command('get')
  .description('Retrieve a single received (inbound) email with full details including HTML, text, and headers')
  .argument('<id>', 'Received email UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'The raw.download_url field is a signed URL (expires ~1 hour) containing the full RFC 2822\nMIME message. Pipe it to curl to save the original email:\n  resend emails receiving get <id> --json | jq -r .raw.download_url | xargs curl > email.eml\n\nAttachments are listed in the attachments array. Use the attachments sub-command to get\ndownload URLs:\n  resend emails receiving attachments <id>',
      output:
        '  {"object":"email","id":"<uuid>","to":["inbox@yourdomain.com"],"from":"sender@external.com","subject":"Hello","html":"<p>Hello!</p>","text":"Hello!","headers":{"x-mailer":"..."},"message_id":"<str>","bcc":[],"cc":[],"reply_to":[],"raw":{"download_url":"<url>","expires_at":"<iso-date>"},"attachments":[]}',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend emails receiving get <email-id>',
        'resend emails receiving get <email-id> --json',
      ],
    })
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const data = await withSpinner(
      { loading: 'Fetching received email...', success: 'Received email fetched', fail: 'Failed to fetch received email' },
      () => resend.emails.receiving.get(id),
      'fetch_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`\nFrom:    ${data.from}`);
      console.log(`To:      ${data.to.join(', ')}`);
      console.log(`Subject: ${data.subject}`);
      console.log(`Date:    ${data.created_at}`);
      if (data.attachments.length > 0) {
        console.log(`Files:   ${data.attachments.length} attachment(s)`);
      }
      if (data.text) {
        const snippet = data.text.length > 200 ? `${data.text.slice(0, 197)}...` : data.text;
        console.log(`\n${snippet}`);
      } else if (data.html) {
        console.log('\n(HTML body only — use --json to view or pipe to a browser)');
      }
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
