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

const mockCreate = vi.fn(async () => ({
  data: {
    object: 'contact_property' as const,
    id: 'b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { create: mockCreate };
  },
}));

describe('contact-properties create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
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

  test('creates property with --key and --type', async () => {
    spies = setupOutputSpies();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await createContactPropertyCommand.parseAsync(
      ['--key', 'company_name', '--type', 'string'],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.key).toBe('company_name');
    expect(args.type).toBe('string');
  });

  test('creates number-type property', async () => {
    spies = setupOutputSpies();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await createContactPropertyCommand.parseAsync(
      ['--key', 'score', '--type', 'number'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.key).toBe('score');
    expect(args.type).toBe('number');
  });

  test('passes string fallback-value to SDK', async () => {
    spies = setupOutputSpies();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await createContactPropertyCommand.parseAsync(
      [
        '--key',
        'company_name',
        '--type',
        'string',
        '--fallback-value',
        'Unknown',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.fallbackValue).toBe('Unknown');
  });

  test('coerces fallback-value to number for number-type properties', async () => {
    spies = setupOutputSpies();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await createContactPropertyCommand.parseAsync(
      ['--key', 'score', '--type', 'number', '--fallback-value', '42'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.fallbackValue).toBe(42);
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await createContactPropertyCommand.parseAsync(
      ['--key', 'plan', '--type', 'string'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d');
  });

  test('errors with missing_key in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await expectExit1(() =>
      createContactPropertyCommand.parseAsync(['--type', 'string'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_key');
  });

  test('errors with missing_type in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await expectExit1(() =>
      createContactPropertyCommand.parseAsync(['--key', 'company_name'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_type');
  });

  test('errors with invalid_fallback_value when number-type gets a non-numeric fallback', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await expectExit1(() =>
      createContactPropertyCommand.parseAsync(
        [
          '--key',
          'score',
          '--type',
          'number',
          '--fallback-value',
          'not-a-number',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_fallback_value');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await expectExit1(() =>
      createContactPropertyCommand.parseAsync(
        ['--key', 'company_name', '--type', 'string'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Key already exists', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/create'
    );
    await expectExit1(() =>
      createContactPropertyCommand.parseAsync(
        ['--key', 'company_name', '--type', 'string'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
