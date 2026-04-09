import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import type { ListReceivingEmail } from 'resend';
import { getCancelExitCode, setSigintHandler } from '../../../lib/cli-exit';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { errorMessage, outputError } from '../../../lib/output';
import { createSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';
import { withRetry } from '../../../lib/with-retry';

const PAGE_SIZE = 100;
const MAX_PAGES_PER_POLL = 5;

const timestamp = (): string =>
  new Date().toLocaleTimeString('en-GB', { hour12: false });

const displayEmail = (email: ListReceivingEmail, jsonMode: boolean): void => {
  if (jsonMode) {
    console.log(JSON.stringify(email));
  } else {
    const to = email.to.join(', ');
    const ts = pc.dim(`[${timestamp()}]`);
    const subject =
      email.subject.length > 50
        ? `${email.subject.slice(0, 47)}...`
        : email.subject;
    process.stderr.write(
      `${ts} ${email.from} -> ${to}  ${pc.bold(`"${subject}"`)}  ${pc.dim(email.id)}\n`,
    );
  }
};

type PageResult = {
  readonly newEmails: ReadonlyArray<ListReceivingEmail>;
  readonly foundSeen: boolean;
};

const extractNewEmails = (
  emails: ReadonlyArray<ListReceivingEmail>,
  seenIds: ReadonlySet<string>,
): PageResult => {
  const idx = emails.findIndex((e) => seenIds.has(e.id));
  return idx === -1
    ? { newEmails: emails, foundSeen: false }
    : { newEmails: emails.slice(0, idx), foundSeen: true };
};

type FetchResult = {
  readonly emails: ReadonlyArray<ListReceivingEmail>;
  readonly error?: string;
  readonly hasMore: boolean;
};

export const listenReceivingCommand = new Command('listen')
  .description('Poll for new inbound emails and display them as they arrive')
  .option(
    '--interval <seconds>',
    'Polling interval in seconds (minimum 2)',
    '5',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Long-running command that polls the receiving API at a fixed
interval and prints each new email as it arrives.

Interactive output shows one line per email. When piped (or with --json),
output is NDJSON (one JSON object per line).

Ctrl+C exits cleanly.`,
      examples: [
        'resend emails receiving listen',
        'resend emails receiving listen --interval 10',
        'resend emails receiving listen --json | head -3',
      ],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const interval = Number.parseInt(_opts.interval ?? '5', 10);
    if (Number.isNaN(interval) || interval < 2) {
      outputError(
        {
          message: 'Polling interval must be at least 2 seconds.',
          code: 'invalid_interval',
        },
        { json: globalOpts.json },
      );
    }

    const resend = await requireClient(globalOpts);
    const jsonMode = globalOpts.json || !isInteractive();

    const spinner = createSpinner(
      'Connecting...',
      globalOpts.quiet || jsonMode,
    );

    const seenIds = new Set<string>();
    let consecutiveErrors = 0;

    try {
      const { data, error } = await resend.emails.receiving.list({ limit: 1 });
      if (error || !data) {
        spinner.fail('Failed to connect');
        outputError(
          {
            message: error?.message ?? 'Unexpected empty response',
            code: 'list_error',
          },
          { json: globalOpts.json },
        );
      }

      for (const email of data.data) {
        seenIds.add(email.id);
      }

      spinner.stop('Ready');
    } catch (err) {
      spinner.fail('Failed to connect');
      outputError(
        {
          message: errorMessage(err, 'Unknown error'),
          code: 'list_error',
        },
        { json: globalOpts.json },
      );
    }

    if (!jsonMode) {
      process.stderr.write('\n');
      process.stderr.write(`  ${pc.bold('Polling:')}  every ${interval}s\n`);
      process.stderr.write(
        `\nListening for new inbound emails. Press Ctrl+C to stop.\n\n`,
      );
    }

    const handlePollError = (message: string): void => {
      consecutiveErrors++;
      if (!jsonMode) {
        process.stderr.write(
          `${pc.dim(`[${timestamp()}]`)} ${pc.yellow('Warning:')} ${message}\n`,
        );
      }
      if (consecutiveErrors >= 5) {
        outputError(
          {
            message: 'Exiting after 5 consecutive API failures.',
            code: 'poll_error',
          },
          { json: globalOpts.json },
        );
      }
    };

    const fetchPages = async (
      cursor: string | undefined,
      accumulated: ReadonlyArray<ListReceivingEmail>,
      pagesLeft: number,
    ): Promise<FetchResult> => {
      if (pagesLeft <= 0) {
        return { emails: accumulated, hasMore: true };
      }

      const params = cursor
        ? { limit: PAGE_SIZE, after: cursor }
        : { limit: PAGE_SIZE };
      const { data, error } = await withRetry(() =>
        resend.emails.receiving.list(params),
      );

      if (error || !data) {
        return {
          emails: accumulated,
          error: error?.message ?? 'Empty response',
          hasMore: false,
        };
      }

      const { newEmails, foundSeen } = extractNewEmails(data.data, seenIds);

      for (const email of newEmails) {
        seenIds.add(email.id);
      }

      const allEmails = [...accumulated, ...newEmails];

      if (foundSeen || !data.has_more) {
        return { emails: allEmails, hasMore: false };
      }

      const nextCursor = data.data[data.data.length - 1]?.id;
      return fetchPages(nextCursor, allEmails, pagesLeft - 1);
    };

    let timeoutHandle: ReturnType<typeof setTimeout>;

    const poll = async (): Promise<void> => {
      try {
        const result = await fetchPages(undefined, [], MAX_PAGES_PER_POLL);

        if (result.error) {
          handlePollError(result.error);
        }

        if (result.emails.length > 0) {
          consecutiveErrors = 0;
          for (const email of result.emails.toReversed()) {
            displayEmail(email, jsonMode);
          }
        } else if (!result.error) {
          consecutiveErrors = 0;
        }
      } catch (err) {
        handlePollError(errorMessage(err, 'Unknown error'));
      } finally {
        timeoutHandle = setTimeout(poll, interval * 1000);
      }
    };

    timeoutHandle = setTimeout(poll, interval * 1000);

    const handleSignal = () => {
      clearTimeout(timeoutHandle);
      if (!jsonMode) {
        process.stderr.write('\nStopped listening.\n');
      }
      process.exit(getCancelExitCode());
    };

    setSigintHandler(handleSignal);
    process.on('SIGTERM', handleSignal);

    await new Promise(() => {});
  });
