import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { createInboxCommand } from '../../../src/commands/inboxes/create';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockCreate = vi.fn(async () => ({
  data: { object: 'inbox' as const, id: INBOX_ID },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { create: mockCreate };
  },
}));

describe('inboxes create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('creates inbox with --email-address', async () => {
    spies = setupOutputSpies();

    await createInboxCommand.parseAsync(
      ['--email-address', 'support@acme.dev'],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toStrictEqual({
      emailAddress: 'support@acme.dev',
    });
  });

  it('passes --name, --from-name, and --forwarding to the SDK', async () => {
    spies = setupOutputSpies();

    await createInboxCommand.parseAsync(
      [
        '--email-address',
        'support@acme.dev',
        '--name',
        'Support',
        '--from-name',
        'Ada from Support',
        '--forwarding',
      ],
      { from: 'user' },
    );

    expect(mockCreate.mock.calls[0][0]).toStrictEqual({
      emailAddress: 'support@acme.dev',
      name: 'Support',
      fromName: 'Ada from Support',
      forwarding: true,
    });
  });

  it('accepts the snake_case --email_address and --from_name flags', async () => {
    spies = setupOutputSpies();

    await createInboxCommand.parseAsync(
      [
        '--email_address',
        'support@acme.dev',
        '--from_name',
        'Ada from Support',
      ],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toStrictEqual({
      emailAddress: 'support@acme.dev',
      fromName: 'Ada from Support',
    });
  });

  it('outputs the create response as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    await createInboxCommand.parseAsync(
      ['--email-address', 'support@acme.dev'],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const output = spies.logSpy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual({ object: 'inbox', id: INBOX_ID });
  });

  it('errors with missing_email_address in non-interactive mode when flag absent', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_email_address');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Inbox already exists', 'invalid_parameter') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxCommand.parseAsync(['--email-address', 'support@acme.dev'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
