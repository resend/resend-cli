import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import type { ListReceivingEmail } from 'resend';
import { getCancelExitCode, setSigintHandler } from '../../../lib/cli-exit';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { retryPoll } from '../../../lib/retry-poll';
import { createSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';

const PAGE_SIZE = 100;
const MAX_CONSECUTIVE_ERRORS = 5;

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

    const result = await retryPoll(() =>
      resend.emails.receiving.list({ limit: 1 }),
    );

    if (!result.success) {
      spinner.fail('Failed to connect');
      outputError(
        {
          message: result.message,
          code: 'list_error',
        },
        { json: globalOpts.json },
      );
    }

    for (const email of result.data.data) {
      seenIds.add(email.id);
    }

    spinner.stop('Ready');

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
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        outputError(
          {
            message: `Exiting after ${MAX_CONSECUTIVE_ERRORS} consecutive API failures.`,
            code: 'poll_error',
          },
          { json: globalOpts.json },
        );
      }
    };

    let timeoutHandle: ReturnType<typeof setTimeout>;

    const poll = async (): Promise<void> => {
      try {
        const newEmails: ListReceivingEmail[] = [];
        let cursor: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const params: { limit: number; after?: string } = {
            limit: PAGE_SIZE,
          };
          if (cursor) {
            params.after = cursor;
          }

          const pollResult = await retryPoll(() =>
            resend.emails.receiving.list(params),
          );
          if (!pollResult.success) {
            handlePollError(pollResult.message);
            return;
          }

          let foundSeen = false;
          for (const email of pollResult.data.data) {
            if (seenIds.has(email.id)) {
              foundSeen = true;
              break;
            }
            newEmails.push(email);
          }

          if (foundSeen || !pollResult.data.has_more) {
            hasMore = false;
          } else {
            cursor = pollResult.data.data[pollResult.data.data.length - 1]?.id;
          }
        }

        consecutiveErrors = 0;

        for (const email of newEmails) {
          seenIds.add(email.id);
        }

        for (const email of [...newEmails].reverse()) {
          displayEmail(email, jsonMode);
        }
      } catch (err) {
        handlePollError(err instanceof Error ? err.message : 'Unknown error');
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
