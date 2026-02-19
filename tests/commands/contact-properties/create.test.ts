import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockCreate = mock(async () => ({
  data: { object: 'contact_property' as const, id: 'prop_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { create: mockCreate };
  },
}));

describe('contact-properties create command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
  });

  test('creates property with --key and --type', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    await createContactPropertyCommand.parseAsync(['--key', 'company_name', '--type', 'string'], { from: 'user' });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.key).toBe('company_name');
    expect(args.type).toBe('string');
  });

  test('creates number-type property', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    await createContactPropertyCommand.parseAsync(['--key', 'score', '--type', 'number'], { from: 'user' });

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.key).toBe('score');
    expect(args.type).toBe('number');
  });

  test('passes string fallback-value to SDK', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    await createContactPropertyCommand.parseAsync(
      ['--key', 'company_name', '--type', 'string', '--fallback-value', 'Unknown'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.fallbackValue).toBe('Unknown');
  });

  test('coerces fallback-value to number for number-type properties', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    await createContactPropertyCommand.parseAsync(
      ['--key', 'score', '--type', 'number', '--fallback-value', '42'],
      { from: 'user' }
    );

    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.fallbackValue).toBe(42);
  });

  test('outputs JSON id when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    await createContactPropertyCommand.parseAsync(['--key', 'plan', '--type', 'string'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('prop_abc123');
  });

  test('errors with missing_key in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    try {
      await createContactPropertyCommand.parseAsync(['--type', 'string'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_key');
  });

  test('errors with missing_type in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    try {
      await createContactPropertyCommand.parseAsync(['--key', 'company_name'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_type');
  });

  test('errors with invalid_fallback_value when number-type gets a non-numeric fallback', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    try {
      await createContactPropertyCommand.parseAsync(
        ['--key', 'score', '--type', 'number', '--fallback-value', 'not-a-number'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_fallback_value');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    try {
      await createContactPropertyCommand.parseAsync(['--key', 'company_name', '--type', 'string'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce({ data: null, error: { message: 'Key already exists', name: 'validation_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createContactPropertyCommand } = await import('../../../src/commands/contact-properties/create');
    try {
      await createContactPropertyCommand.parseAsync(['--key', 'company_name', '--type', 'string'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
