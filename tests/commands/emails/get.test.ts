import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockGet = mock(async () => ({
  data: {
    object: 'email' as const,
    id: 'email_abc123',
    from: 'you@domain.com',
    to: ['user@example.com'],
    subject: 'Hello',
    html: '<p>Hi</p>',
    text: 'Hi',
    created_at: '2026-02-18T12:00:00.000Z',
    scheduled_at: null,
    last_event: 'delivered' as const,
    bcc: null,
    cc: null,
    reply_to: null,
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { get: mockGet };
  },
}));

describe('emails get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  test('calls SDK get with the provided id', async () => {
    spies = setupOutputSpies();

    const { getEmailCommand } = await import(
      '../../../src/commands/emails/get'
    );
    await getEmailCommand.parseAsync(['email_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('email_abc123');
  });

  test('outputs JSON with full email fields when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getEmailCommand } = await import(
      '../../../src/commands/emails/get'
    );
    await getEmailCommand.parseAsync(['email_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('email_abc123');
    expect(parsed.from).toBe('you@domain.com');
    expect(parsed.subject).toBe('Hello');
    expect(parsed.last_event).toBe('delivered');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getEmailCommand } = await import(
      '../../../src/commands/emails/get'
    );
    await expectExit1(() =>
      getEmailCommand.parseAsync(['email_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getEmailCommand } = await import(
      '../../../src/commands/emails/get'
    );
    await expectExit1(() =>
      getEmailCommand.parseAsync(['email_nonexistent'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
