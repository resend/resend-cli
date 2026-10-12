import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../../lib/pagination';
import { pickId } from '../../../../lib/prompts';
import { inboxPickerConfig } from '../../utils';
import { inboxThreadPickerConfig, renderThreadEmailsTable } from '../utils';

export const listInboxThreadEmailsCommand = new Command('list')
  .alias('ls')
  .description('List the emails in a thread')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option('--limit <n>', 'Maximum number of emails to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — list emails after this email ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — list emails before this email ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Emails are ordered oldest first and include their html and text bodies.
Pass the last email ID of the previous page as --after to fetch the next page.`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>|null","message_id":"<message-id>|null","html":"<html>|null","text":"<text>|null","attachments":[],"read":true,"received_at":"<date>"}]}`,
      errorCodes: [
        'auth_error',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes threads emails list --inbox_id <inbox_id> --thread_id <thread_id>',
        'resend inboxes threads emails list --inbox_id <inbox_id> --thread_id <thread_id> --json',
        'resend inboxes threads emails list --inbox_id <inbox_id> --thread_id <thread_id> --limit 25 --after <email_id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      opts.thread_id,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    await runList(
      {
        loading: 'Fetching emails...',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.list({
            inboxId,
            threadId,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderThreadEmailsTable(list.data));
          printPaginationHint(list, 'inboxes threads emails list', {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
            extraFlags: `--inbox_id ${inboxId} --thread_id ${threadId}`,
          });
        },
      },
      globalOpts,
    );
  });
