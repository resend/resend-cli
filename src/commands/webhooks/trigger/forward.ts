import type { GlobalOpts } from '../../../lib/client';
import { safeTerminalText } from '../../../lib/safe-terminal-text';
import { failWebhookTrigger } from './errors';
import type { PreparedRequest } from './request';

const MAX_RESPONSE_BYTES = 4_096;
const FORWARD_TIMEOUT_MS = 10_000;

export type ForwardResult = {
  httpStatus: number;
  durationMs: number;
  responseBody: string;
  responseTruncated: boolean;
};

type ReadResponseBody = {
  body: string;
  truncated: boolean;
};

async function readResponseBody(response: Response): Promise<ReadResponseBody> {
  if (!response.body) {
    return { body: '', truncated: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const remaining = MAX_RESPONSE_BYTES - total;
    if (value.byteLength > remaining) {
      chunks.push(value.subarray(0, remaining));
      total += remaining;
      truncated = true;
      await reader.cancel();
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  const text = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
  ).toString('utf8');
  return { body: safeTerminalText(text), truncated };
}

function failForwardError(
  error: unknown,
  fallbackMessage: string,
  opts: GlobalOpts,
): never {
  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    failWebhookTrigger(
      `Webhook endpoint request timed out after ${FORWARD_TIMEOUT_MS} ms.`,
      'forward_timeout',
      opts,
    );
  }
  failWebhookTrigger(fallbackMessage, 'forward_error', opts);
}

export async function forwardWebhookRequest(
  request: PreparedRequest,
  opts: GlobalOpts,
): Promise<ForwardResult> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: Uint8Array.from(request.body),
      redirect: 'manual',
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch (error) {
    failForwardError(
      error,
      'Could not connect to the webhook endpoint. Check the URL and whether the local service is running.',
      opts,
    );
  }

  let responseBody: ReadResponseBody;
  try {
    responseBody = await readResponseBody(response);
  } catch (error) {
    failForwardError(
      error,
      'Could not read the response from the webhook endpoint.',
      opts,
    );
  }

  const durationMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    failWebhookTrigger(
      `Webhook endpoint returned HTTP ${response.status}${responseBody.truncated ? ' (response body truncated)' : ''}.`,
      'forward_http_error',
      opts,
      { statusCode: response.status, body: responseBody.body },
    );
  }

  return {
    httpStatus: response.status,
    durationMs,
    responseBody: responseBody.body,
    responseTruncated: responseBody.truncated,
  };
}
