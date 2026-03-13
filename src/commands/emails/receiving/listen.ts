import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import type { ListReceivingEmail } from 'resend';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { errorMessage, outputError } from '../../../lib/output';
import { createSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';

const PAGE_SIZE = 100;

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function displayEmail(email: ListReceivingEmail, jsonMode: boolean): void {
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
}

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

    const resend = requireClient(globalOpts);
    const jsonMode = globalOpts.json || !isInteractive();

    // Initial poll — just grab the latest email to establish our starting point
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

    // Print banner
    if (!jsonMode) {
      process.stderr.write('\n');
      process.stderr.write(`  ${pc.bold('Polling:')}  every ${interval}s\n`);
      process.stderr.write(
        `\nListening for new inbound emails. Press Ctrl+C to stop.\n\n`,
      );
    }

    // Helper: handle consecutive poll errors and exit if threshold reached
    function handlePollError(message: string): void {
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
    }

    // Poll loop — paginates until it hits a seen email to guarantee no misses
    let timeoutHandle: ReturnType<typeof setTimeout>;

    async function poll(): Promise<void> {
      try {
        const newEmails: ListReceivingEmail[] = [];
        let cursor: string | undefined;
        let hasMore = true;

        // Paginate through results until we find an email we've already seen
        while (hasMore) {
          const params: { limit: number; after?: string } = {
            limit: PAGE_SIZE,
          };
          if (cursor) {
            params.after = cursor;
          }

          const { data, error } = await resend.emails.receiving.list(params);
          if (error || !data) {
            handlePollError(error?.message ?? 'Empty response');
            return;
          }

          let foundSeen = false;
          for (const email of data.data) {
            if (seenIds.has(email.id)) {
              foundSeen = true;
              break;
            }
            newEmails.push(email);
          }

          if (foundSeen || !data.has_more) {
            hasMore = false;
          } else {
            // Use the last email as cursor for the next page
            cursor = data.data[data.data.length - 1]?.id;
          }
        }

        consecutiveErrors = 0;

        // Mark all new emails as seen
        for (const email of newEmails) {
          seenIds.add(email.id);
        }

        // Display in chronological order (oldest first)
        for (const email of newEmails.reverse()) {
          displayEmail(email, jsonMode);
        }
      } catch (err) {
        handlePollError(errorMessage(err, 'Unknown error'));
      } finally {
        timeoutHandle = setTimeout(poll, interval * 1000);
      }
    }

    timeoutHandle = setTimeout(poll, interval * 1000);

    // Graceful exit
    const handleSignal = () => {
      clearTimeout(timeoutHandle);
      if (!jsonMode) {
        process.stderr.write('\nStopped listening.\n');
      }
      process.exit(0);
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    // Keep alive
    await new Promise(() => {});
  });
