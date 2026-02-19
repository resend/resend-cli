import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockUpdate = mock(async () => ({
  data: { object: 'contact_property' as const, id: 'prop_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { update: mockUpdate };
  },
}));

describe('contact-properties update command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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

  test('updates property fallback value', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactPropertyCommand } = await import('../../../src/commands/contact-properties/update');
    await updateContactPropertyCommand.parseAsync(['prop_abc123', '--fallback-value', 'Acme Corp'], { from: 'user' });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as any;
    expect(args.id).toBe('prop_abc123');
    expect(args.fallbackValue).toBe('Acme Corp');
  });

  test('clears fallback value with --clear-fallback-value', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactPropertyCommand } = await import('../../../src/commands/contact-properties/update');
    await updateContactPropertyCommand.parseAsync(['prop_abc123', '--clear-fallback-value'], { from: 'user' });

    const args = mockUpdate.mock.calls[0][0] as any;
    expect(args.id).toBe('prop_abc123');
    expect(args.fallbackValue).toBeNull();
  });

  test('errors with conflicting_flags when both --fallback-value and --clear-fallback-value are given', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import('../../../src/commands/contact-properties/update');
    try {
      await updateContactPropertyCommand.parseAsync(
        ['prop_abc123', '--fallback-value', 'Acme', '--clear-fallback-value'],
        { from: 'user' }
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('conflicting_flags');
  });

  test('outputs JSON result when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { updateContactPropertyCommand } = await import('../../../src/commands/contact-properties/update');
    await updateContactPropertyCommand.parseAsync(['prop_abc123', '--fallback-value', 'Test'], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('prop_abc123');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import('../../../src/commands/contact-properties/update');
    try {
      await updateContactPropertyCommand.parseAsync(['prop_abc123', '--fallback-value', 'Test'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce({ data: null, error: { message: 'Property not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import('../../../src/commands/contact-properties/update');
    try {
      await updateContactPropertyCommand.parseAsync(['nonexistent_id', '--fallback-value', 'Test'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
