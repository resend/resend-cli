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
    object: 'contact' as const,
    id: 'contact_abc123',
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    created_at: '2026-01-01T00:00:00.000Z',
    unsubscribed: false,
    properties: {},
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { get: mockGet };
  },
}));

describe('contacts get command', () => {
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

  test('calls SDK with contact ID', async () => {
    spies = setupOutputSpies();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await getContactCommand.parseAsync(['contact_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('contact_abc123');
  });

  test('calls SDK with email address', async () => {
    spies = setupOutputSpies();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await getContactCommand.parseAsync(['jane@example.com'], { from: 'user' });

    expect(mockGet.mock.calls[0][0]).toBe('jane@example.com');
  });

  test('outputs JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await getContactCommand.parseAsync(['contact_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('contact_abc123');
    expect(parsed.email).toBe('jane@example.com');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await expectExit1(() =>
      getContactCommand.parseAsync(['contact_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Contact not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await expectExit1(() =>
      getContactCommand.parseAsync(['nonexistent_id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
