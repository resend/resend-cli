import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockGet = vi.fn(async () => ({
  data: {
    object: 'contact' as const,
    id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    created_at: '2026-01-01T00:00:00.000Z',
    unsubscribed: false,
    properties: {},
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { get: mockGet };
  },
}));

describe('contacts get command', () => {
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

  test('calls SDK with contact ID', async () => {
    spies = setupOutputSpies();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await getContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe(
      'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
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
    await getContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(parsed.email).toBe('jane@example.com');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getContactCommand } = await import(
      '../../../src/commands/contacts/get'
    );
    await expectExit1(() =>
      getContactCommand.parseAsync(['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Contact not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
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
