import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureTestEnv,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'email_abc123',
        message_id: '<abc123@email.example.com>',
        from: 'you@domain.com',
        to: ['user@example.com'],
        subject: 'Hello',
        created_at: '2026-02-18T12:00:00.000Z',
        scheduled_at: null,
        last_event: 'delivered' as const,
        bcc: null,
        cc: null,
        reply_to: null,
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { list: mockList };
  },
}));

describe('emails list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
    setNonInteractive();
  });

  afterEach(() => {
    restoreEnv();
    spies = undefined;
  });

  it('outputs JSON with message_id for each email', async () => {
    spies = setupOutputSpies();

    const { listEmailsCommand } = await import(
      '../../../src/commands/emails/list'
    );
    await listEmailsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.data[0].message_id).toBe('<abc123@email.example.com>');
  });
});
