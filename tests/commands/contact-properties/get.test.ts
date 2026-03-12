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
    object: 'contact_property' as const,
    id: 'b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d',
    key: 'company_name',
    type: 'string' as const,
    fallbackValue: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { get: mockGet };
  },
}));

describe('contact-properties get command', () => {
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

  test('calls SDK with the given ID', async () => {
    spies = setupOutputSpies();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await getContactPropertyCommand.parseAsync(
      ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d'],
      {
        from: 'user',
      },
    );

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe(
      'b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d',
    );
  });

  test('outputs JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await getContactPropertyCommand.parseAsync(
      ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d'],
      {
        from: 'user',
      },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d');
    expect(parsed.key).toBe('company_name');
    expect(parsed.type).toBe('string');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/get'
    );
    await expectExit1(() =>
      getContactPropertyCommand.parseAsync(
        ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Property not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
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
