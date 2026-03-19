import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import type { Resend, WebhookEvent } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { requireText } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import { ALL_WEBHOOK_EVENTS, normalizeEvents } from './utils';

const SVIX_HEADERS = ['svix-id', 'svix-timestamp', 'svix-signature'];

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function summarizeEvent(body: Record<string, unknown>): {
  type: string;
  resourceId: string;
  detail: string;
} {
  const type = (body.type as string) ?? 'unknown';
  const data = (body.data as Record<string, unknown>) ?? {};

  const resourceId = (data.id as string) ?? '';

  let detail = '';
  if (type.startsWith('email.')) {
    const from = (data.from as string) ?? '';
    const to = Array.isArray(data.to) ? (data.to[0] as string) : '';
    if (from || to) {
      detail = `${from} -> ${to}`;
    }
  } else if (type.startsWith('domain.')) {
    detail = (data.name as string) ?? '';
  } else if (type.startsWith('contact.')) {
    detail = (data.email as string) ?? '';
  }

  return { type, resourceId, detail };
}

function formatStatus(status: number): string {
  const text = `${status} ${statusText(status)}`;
  if (status >= 200 && status < 300) {
    return pc.green(text);
  }
  if (status >= 400 && status < 500) {
    return pc.yellow(text);
  }
  return pc.red(text);
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return map[code] ?? '';
}

async function forwardPayload(
  forwardTo: string,
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<{ status: number }> {
  const forwardHeaders: Record<string, string> = {
    'content-type': 'application/json',
  };
  for (const h of SVIX_HEADERS) {
    const val = headers[h];
    if (val) {
      forwardHeaders[h] = val;
    }
  }

  const url = forwardTo.startsWith('http') ? forwardTo : `http://${forwardTo}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: forwardHeaders,
    body: rawBody,
  });
  return { status: resp.status };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function cleanup(
  resend: Resend,
  webhookId: string,
  server: ReturnType<typeof createServer>,
) {
  process.stderr.write('\nCleaning up...');
  try {
    await resend.webhooks.remove(webhookId);
    process.stderr.write(` Webhook ${webhookId} deleted.\n`);
  } catch {
    process.stderr.write(` Failed to delete webhook ${webhookId}.\n`);
  }
  server.close();
}

export const listenWebhookCommand = new Command('listen')
  .description('Listen for webhook events locally during development')
  .option('--url <url>', 'Public URL for receiving webhooks (your tunnel URL)')
  .option('--forward-to <url>', 'Forward payloads to this local URL')
  .option('--events <events...>', 'Event types to listen for (default: all)')
  .option('--port <port>', 'Local server port', '4318')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Start a local server that receives Resend webhook events in real time.

You must provide a public URL (e.g. from ngrok or localtunnel) that
points to the local server port. The CLI will:
  1. Start a local HTTP server on --port (default 4318)
  2. Register a temporary Resend webhook pointing at --url
  3. Display incoming events in the terminal
  4. Optionally forward payloads to --forward-to (with original Svix headers)
  5. Delete the temporary webhook on exit (Ctrl+C)

Important: your tunnel must forward traffic to the same port as --port (default 4318).
For example, if using ngrok: ngrok http 4318`,
      examples: [
        'resend webhooks listen --url https://example.ngrok-free.app',
        'resend webhooks listen --url https://example.ngrok-free.app --forward-to localhost:3000/webhook',
        'resend webhooks listen --url https://example.ngrok-free.app --events email.sent email.bounced',
        'resend webhooks listen --url https://example.ngrok-free.app --port 8080',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const url = await requireText(
      opts.url,
      {
        message: 'Public tunnel URL',
        placeholder: 'https://example.ngrok-free.app',
        validate: (v) => {
          if (!v) {
            return 'URL is required';
          }
          if (!v.startsWith('https://') && !v.startsWith('http://')) {
            return 'URL must start with http:// or https://';
          }
          return undefined;
        },
      },
      { message: 'Missing --url flag.', code: 'missing_url' },
      globalOpts,
    );

    const port = Number.parseInt(opts.port ?? '4318', 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      outputError(
        { message: 'Invalid port number.', code: 'invalid_port' },
        { json: globalOpts.json },
      );
    }

    const normalized = opts.events?.length
      ? normalizeEvents(opts.events)
      : undefined;

    let selectedEvents: WebhookEvent[];
    if (normalized?.includes('all')) {
      selectedEvents = ALL_WEBHOOK_EVENTS;
    } else if (normalized?.length) {
      selectedEvents = normalized as WebhookEvent[];
    } else {
      selectedEvents = ALL_WEBHOOK_EVENTS;
    }

    const resend = await requireClient(globalOpts);
    const jsonMode = globalOpts.json || !isInteractive();

    // Start local server
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.writeHead(405).end('Method not allowed');
          return;
        }

        const rawBody = await readBody(req);
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(rawBody);
        } catch {
          res.writeHead(400).end('Invalid JSON');
          return;
        }

        const svixHeaders: Record<string, string | undefined> = {};
        for (const h of SVIX_HEADERS) {
          const val = req.headers[h];
          svixHeaders[h] = Array.isArray(val) ? val[0] : val;
        }

        const { type, resourceId, detail } = summarizeEvent(body);

        if (jsonMode) {
          const entry: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            type,
            resource_id: resourceId,
            payload: body,
          };

          if (opts.forwardTo) {
            try {
              const { status } = await forwardPayload(
                opts.forwardTo,
                rawBody,
                svixHeaders,
              );
              entry.forwarded = { url: opts.forwardTo, status };
            } catch (err) {
              entry.forwarded = {
                url: opts.forwardTo,
                error: err instanceof Error ? err.message : 'Unknown error',
              };
            }
          }

          console.log(JSON.stringify(entry));
        } else {
          const ts = pc.dim(`[${timestamp()}]`);
          const typePad = type.padEnd(20);
          const idPad = resourceId.padEnd(14);
          process.stderr.write(
            `${ts} ${pc.bold(typePad)} ${pc.cyan(idPad)} ${detail}\n`,
          );

          if (opts.forwardTo) {
            const target = opts.forwardTo.startsWith('http')
              ? opts.forwardTo
              : `http://${opts.forwardTo}`;
            try {
              const { status } = await forwardPayload(
                opts.forwardTo,
                rawBody,
                svixHeaders,
              );
              process.stderr.write(
                `${pc.dim('           -> POST')} ${target} ${pc.dim(`[${formatStatus(status)}]`)}\n`,
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              process.stderr.write(
                `${pc.dim('           -> POST')} ${target} ${pc.red(`[Error: ${msg}]`)}\n`,
              );
            }
          }
        }

        res.writeHead(200).end('OK');
      },
    );

    try {
      await new Promise<void>((resolve, reject) => {
        server.on('error', reject);
        server.listen(port, resolve);
      });
    } catch (err) {
      outputError(
        {
          message:
            err instanceof Error
              ? `Failed to start local server on port ${port}: ${err.message}`
              : `Failed to start local server on port ${port}`,
          code: 'server_listen_error',
        },
        { json: globalOpts.json },
      );
    }

    // Register webhook
    const spinner = createSpinner(
      'Setting up webhook listener...',
      globalOpts.quiet,
    );

    let webhookId: string;
    try {
      const { data, error } = await resend.webhooks.create({
        endpoint: url,
        events: selectedEvents,
      });
      if (error || !data) {
        spinner.fail('Failed to create webhook');
        server.close();
        outputError(
          {
            message: error?.message ?? 'Unexpected empty response',
            code: 'create_error',
          },
          { json: globalOpts.json },
        );
      }
      webhookId = data.id;
    } catch (err) {
      spinner.fail('Failed to create webhook');
      server.close();
      outputError(
        {
          message: err instanceof Error ? err.message : 'Unknown error',
          code: 'create_error',
        },
        { json: globalOpts.json },
      );
    }

    spinner.stop('Webhook listener ready');

    // Print banner
    if (!jsonMode) {
      const eventsDisplay =
        selectedEvents.length === ALL_WEBHOOK_EVENTS.length
          ? 'all events'
          : selectedEvents.length <= 3
            ? selectedEvents.join(', ')
            : `${selectedEvents.slice(0, 3).join(', ')} (+${selectedEvents.length - 3} more)`;

      process.stderr.write('\n');
      process.stderr.write(`  ${pc.bold('Webhook:')}  ${webhookId}\n`);
      process.stderr.write(`  ${pc.bold('Endpoint:')} ${url}\n`);
      process.stderr.write(`  ${pc.bold('Events:')}   ${eventsDisplay}\n`);
      process.stderr.write(
        `  ${pc.bold('Server:')}   http://localhost:${port}\n`,
      );
      if (opts.forwardTo) {
        const fwd = opts.forwardTo.startsWith('http')
          ? opts.forwardTo
          : `http://${opts.forwardTo}`;
        process.stderr.write(`  ${pc.bold('Forward:')}  ${fwd}\n`);
      }
      process.stderr.write(
        `\nReady! Listening for webhook events. Press Ctrl+C to stop.\n\n`,
      );
    }

    // Cleanup handler
    let cleaningUp = false;
    const handleSignal = async () => {
      if (cleaningUp) {
        return;
      }
      cleaningUp = true;
      await cleanup(resend, webhookId, server);
      process.exit(0);
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    // Keep the process alive until signal
    await new Promise(() => {});
  });
