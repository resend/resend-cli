import { randomUUID } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import type { GlobalOpts } from '../../../lib/client';
import { safeTerminalText } from '../../../lib/safe-terminal-text';
import { failWebhookTrigger } from './errors';
import {
  createSyntheticEvent,
  SYNTHETIC_EVENT_TYPES,
  type SyntheticEventType,
  type TriggerOverrides,
} from './fixtures';

export type PreparedRequest = {
  eventType: SyntheticEventType;
  deliveryId: string;
  url: string;
  body: Buffer;
  headers: Record<string, string>;
};

function isSyntheticEventType(value: string): value is SyntheticEventType {
  return SYNTHETIC_EVENT_TYPES.includes(value as SyntheticEventType);
}

function validateSecret(secret: string | undefined): string | undefined {
  if (!secret?.startsWith('whsec_')) {
    return undefined;
  }

  const encoded = secret.slice('whsec_'.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    return undefined;
  }

  const decoded = Buffer.from(encoded, 'base64');
  if (
    decoded.length === 0 ||
    decoded.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')
  ) {
    return undefined;
  }
  return secret;
}

function validateForwardUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function validateDeliveryId(value: string): boolean {
  return value.length <= 256 && /^[\x21-\x7e]+$/.test(value);
}

export function prepareWebhookRequest(
  eventTypeValue: string,
  forwardTo: string,
  overrides: TriggerOverrides,
  suppliedDeliveryId: string | undefined,
  opts: GlobalOpts,
): PreparedRequest {
  if (!isSyntheticEventType(eventTypeValue)) {
    failWebhookTrigger(
      `Unsupported event type "${safeTerminalText(eventTypeValue)}". Available event types: ${SYNTHETIC_EVENT_TYPES.join(', ')}.`,
      'unsupported_event_type',
      opts,
    );
  }

  const url = validateForwardUrl(forwardTo);
  if (!url) {
    failWebhookTrigger(
      '--forward-to must be a valid http:// or https:// URL without embedded credentials.',
      'invalid_forward_url',
      opts,
    );
  }

  const secret = validateSecret(process.env.RESEND_WEBHOOK_SECRET);
  if (!secret) {
    failWebhookTrigger(
      'Set RESEND_WEBHOOK_SECRET to a valid whsec_ signing secret for development.',
      'webhook_secret_error',
      opts,
    );
  }

  const deliveryId = suppliedDeliveryId ?? `msg_local_${randomUUID()}`;
  if (!validateDeliveryId(deliveryId)) {
    failWebhookTrigger(
      'The delivery ID must be 1–256 visible ASCII characters without whitespace or control characters.',
      'invalid_delivery_id',
      opts,
    );
  }

  const body = Buffer.from(
    JSON.stringify(createSyntheticEvent(eventTypeValue, overrides, opts)),
  );

  const signedAt = new Date();
  const timestamp = String(Math.floor(signedAt.getTime() / 1000));
  let signature: string;
  try {
    signature = new Webhook(secret).sign(deliveryId, signedAt, body);
  } catch {
    failWebhookTrigger(
      'RESEND_WEBHOOK_SECRET is not a valid webhook signing secret.',
      'webhook_secret_error',
      opts,
    );
  }

  return {
    eventType: eventTypeValue,
    deliveryId,
    url,
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': deliveryId,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    },
  };
}
