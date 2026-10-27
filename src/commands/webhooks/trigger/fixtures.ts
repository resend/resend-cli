import { randomUUID } from 'node:crypto';
import type {
  EmailBouncedEvent,
  EmailComplainedEvent,
  EmailDeliveredEvent,
  WebhookEventPayload,
} from 'resend';
import type { GlobalOpts } from '../../../lib/client';
import { safeTerminalText } from '../../../lib/safe-terminal-text';
import { failWebhookTrigger } from './errors';

export const SYNTHETIC_EVENT_TYPES = [
  'email.delivered',
  'email.bounced',
  'email.complained',
] as const;

export type SyntheticEventType = (typeof SYNTHETIC_EVENT_TYPES)[number];

export type TriggerOverrides = {
  emailId?: string;
  messageId?: string;
  from?: string;
  to?: string[];
  subject?: string;
  broadcastId?: string;
  templateId?: string;
  tag?: string[];
  eventCreatedAt?: string;
  emailCreatedAt?: string;
  bounceType?: string;
  bounceSubType?: string;
  bounceMessage?: string;
};

function parseTimestamp(
  value: string | undefined,
  optionName: string,
  fallback: Date,
  opts: GlobalOpts,
): string {
  if (value === undefined) {
    return fallback.toISOString();
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    failWebhookTrigger(
      `${optionName} must be a valid ISO 8601 timestamp.`,
      'invalid_option',
      opts,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    failWebhookTrigger(
      `${optionName} must be a valid ISO 8601 timestamp.`,
      'invalid_option',
      opts,
    );
  }
  return parsed.toISOString();
}

function parseTags(
  values: string[] | undefined,
  opts: GlobalOpts,
): Record<string, string> {
  if (!values?.length) {
    return { category: 'resend-cli-local-test' };
  }

  const tags = Object.create(null) as Record<string, string>;
  for (const value of values) {
    const separator = value.indexOf('=');
    if (separator < 1) {
      failWebhookTrigger(
        `Invalid tag format "${safeTerminalText(value)}". Expected name=value.`,
        'invalid_option',
        opts,
      );
    }
    const name = value.slice(0, separator);
    if (Object.hasOwn(tags, name)) {
      failWebhookTrigger(
        `The tag name "${safeTerminalText(name)}" was provided more than once.`,
        'invalid_option',
        opts,
      );
    }
    tags[name] = value.slice(separator + 1);
  }
  return tags;
}

export function createSyntheticEvent(
  eventType: SyntheticEventType,
  overrides: TriggerOverrides,
  opts: GlobalOpts,
): WebhookEventPayload {
  const now = new Date();
  const createdAt = parseTimestamp(
    overrides.eventCreatedAt,
    '--event-created-at',
    now,
    opts,
  );
  const emailCreatedAt = parseTimestamp(
    overrides.emailCreatedAt,
    '--email-created-at',
    new Date(Date.parse(createdAt) - 60_000),
    opts,
  );
  const bounceOverrides = [
    overrides.bounceType,
    overrides.bounceSubType,
    overrides.bounceMessage,
  ];
  if (
    eventType !== 'email.bounced' &&
    bounceOverrides.some((value) => value !== undefined)
  ) {
    failWebhookTrigger(
      'Bounce options only apply to email.bounced events.',
      'invalid_option',
      opts,
    );
  }

  const baseData = {
    broadcast_id: overrides.broadcastId ?? randomUUID(),
    created_at: emailCreatedAt,
    email_id: overrides.emailId ?? randomUUID(),
    message_id: overrides.messageId ?? `<${randomUUID()}@email.example.test>`,
    from: overrides.from ?? 'sender@example.test',
    to: overrides.to ?? ['recipient@example.test'],
    subject: overrides.subject ?? 'Synthetic webhook event for local testing',
    template_id: overrides.templateId ?? randomUUID(),
  } satisfies Omit<EmailDeliveredEvent['data'], 'tags'>;
  const tags = parseTags(overrides.tag, opts);

  switch (eventType) {
    case 'email.delivered':
      return {
        type: eventType,
        created_at: createdAt,
        data: { ...baseData, tags },
      } satisfies EmailDeliveredEvent;
    case 'email.bounced':
      return {
        type: eventType,
        created_at: createdAt,
        data: {
          ...baseData,
          bounce: {
            type: overrides.bounceType ?? 'Permanent',
            subType: overrides.bounceSubType ?? 'General',
            message:
              overrides.bounceMessage ??
              'Synthetic bounce for local webhook testing',
          },
          tags,
        },
      } satisfies EmailBouncedEvent;
    case 'email.complained':
      return {
        type: eventType,
        created_at: createdAt,
        data: { ...baseData, tags },
      } satisfies EmailComplainedEvent;
  }
}
