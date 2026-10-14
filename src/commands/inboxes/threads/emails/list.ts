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
import { snakeCaseAlias } from '../../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../../utils';
import { inboxThreadPickerConfig, renderThreadEmailsTable } from '../utils';

export const listInboxThreadEmailsCommand = new Command('list')
  .alias('ls')
  .description('List the emails in a thread')
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[threadId]', 'Thread UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
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
Pass the last email ID of the previous page as --after to fetch the next page.
A cursor that is not an email of the thread returns an error.`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>|null","message_id":"<message-id>|null","html":"<html>|null","text":"<text>|null","attachments":[],"read":true,"received_at":"<date>"}]}`,
      errorCodes: [
        'auth_error',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes threads emails list <inbox-id> <thread-id>',
        'resend inboxes threads emails list <inbox-id> <thread-id> --json',
        'resend inboxes threads emails list <inbox-id> <thread-id> --limit 25 --after <email-id> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      ids.thread,
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
          printPaginationHint(
            list,
            `inboxes threads emails list ${inboxId} ${threadId}`,
            {
              limit,
              before: opts.before,
              apiKey: globalOpts.apiKey,
              profile: globalOpts.profile,
            },
          );
        },
      },
      globalOpts,
    );
  });
