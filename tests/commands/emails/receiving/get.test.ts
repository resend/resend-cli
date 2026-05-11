import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const mockGet = vi.fn(async () => ({
  data: {
    object: 'email' as const,
    id: 'rcv_abc123',
    to: ['inbox@example.com'],
    from: 'sender@external.com',
    subject: 'Hello from outside',
    created_at: '2026-02-18T12:00:00.000Z',
    bcc: null,
    cc: null,
    reply_to: null,
    html: '<p>Hello!</p>',
    text: 'Hello!',
    headers: { 'x-mailer': 'Thunderbird' },
    message_id: '<hello@external.com>',
    raw: {
      download_url: 'https://storage.example.com/signed/raw-email',
      expires_at: '2026-02-18T13:00:00.000Z',
    },
    attachments: [],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { receiving: { get: mockGet } };
  },
}));

describe('emails receiving get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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

  it('calls SDK get with the provided id', async () => {
    spies = setupOutputSpies();

    const { getReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/get'
    );
    await getReceivingCommand.parseAsync(['rcv_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('rcv_abc123');
  });

  it('outputs JSON with full email fields when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/get'
    );
    await getReceivingCommand.parseAsync(['rcv_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('rcv_abc123');
    expect(parsed.from).toBe('sender@external.com');
    expect(parsed.subject).toBe('Hello from outside');
    expect(parsed.text).toBe('Hello!');
    expect(parsed.raw.download_url).toBe(
      'https://storage.example.com/signed/raw-email',
    );
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/get'
    );
    await expectExit1(() =>
      getReceivingCommand.parseAsync(['rcv_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getReceivingCommand } = await import(
      '../../../../src/commands/emails/receiving/get'
    );
    await expectExit1(() =>
      getReceivingCommand.parseAsync(['rcv_nonexistent'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
