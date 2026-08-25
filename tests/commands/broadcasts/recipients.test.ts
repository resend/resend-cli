import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { recipientsBroadcastCommand } from '../../../src/commands/broadcasts/recipients';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockRecipients = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'b2Zmc2V0OjA',
        contact_id: 'e169aa45-1ecf-4183-9955-b1499d5701d3',
        email: 'carter@example.com',
        count: 3,
        clicked_links: [
          { url: 'https://resend.com/pricing', clicks: 2 },
          { url: 'https://resend.com/docs', clicks: 1 },
        ],
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { recipients: mockRecipients };
  },
}));

describe('broadcasts recipients command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRecipients.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  it('fetches recipients by id and type', async () => {
    spies = setupOutputSpies();

    await recipientsBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--type', 'clicked'],
      { from: 'user' },
    );

    expect(mockRecipients).toHaveBeenCalledTimes(1);
    expect(mockRecipients.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
    const opts = mockRecipients.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.type).toBe('clicked');
    expect(opts.limit).toBe(20);
  });

  it('passes --email and --bounce-type to SDK', async () => {
    spies = setupOutputSpies();

    await recipientsBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--type',
        'bounced',
        '--email',
        '@example.com',
        '--bounce-type',
        'permanent',
      ],
      { from: 'user' },
    );

    const opts = mockRecipients.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.type).toBe('bounced');
    expect(opts.email).toBe('@example.com');
    expect(opts.bounceType).toBe('permanent');
  });

  it('passes --limit, --after, and --before to SDK', async () => {
    spies = setupOutputSpies();

    await recipientsBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--type',
        'sent',
        '--limit',
        '5',
        '--after',
        'c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a4a4',
      ],
      { from: 'user' },
    );

    const opts = mockRecipients.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.limit).toBe(5);
    expect(opts.after).toBe('c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a4a4');
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    await recipientsBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--type', 'clicked'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].email).toBe('carter@example.com');
    expect(parsed.data[0].clicked_links).toHaveLength(2);
  });

  it('errors with missing_type in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      recipientsBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_type');
  });

  it('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      recipientsBroadcastCommand.parseAsync(
        [
          'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '--type',
          'sent',
          '--limit',
          '999',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  it('errors with invalid_pagination when --after and --before are both set', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      recipientsBroadcastCommand.parseAsync(
        [
          'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '--type',
          'sent',
          '--after',
          'cursor-a',
          '--before',
          'cursor-b',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_pagination');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      recipientsBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--type', 'sent'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRecipients.mockResolvedValueOnce(
      mockSdkError('Broadcast not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      recipientsBroadcastCommand.parseAsync(
        ['00000000-0000-0000-0000-00000000bad0', '--type', 'sent'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
