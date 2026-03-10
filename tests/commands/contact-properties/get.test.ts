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
    object: 'contact_property' as const,
    id: 'prop_abc123',
    key: 'company_name',
    type: 'string' as const,
    fallbackValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { get: mockGet };
  },
}));

describe('contact-properties get command', () => {
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

  test('calls SDK with the given ID', async () => {
    spies = setupOutputSpies();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await getContactPropertyCommand.parseAsync(['prop_abc123'], {
      from: 'user',
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('prop_abc123');
  });

  test('outputs JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await getContactPropertyCommand.parseAsync(['prop_abc123'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('prop_abc123');
    expect(parsed.key).toBe('company_name');
    expect(parsed.type).toBe('string');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await expectExit1(() =>
      getContactPropertyCommand.parseAsync(['prop_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Property not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await expectExit1(() =>
      getContactPropertyCommand.parseAsync(['nonexistent_id'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
