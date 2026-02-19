import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import { ExitError, setNonInteractive, mockExitThrow } from '../../helpers';

const mockList = mock(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'prop_abc123',
        key: 'company_name',
        type: 'string' as const,
        fallbackValue: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { list: mockList };
  },
}));

describe('contact-properties list command', () => {
  const originalEnv = { ...process.env };
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
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

  test('calls SDK with default limit of 10', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    await listContactPropertiesCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as any;
    expect(args.limit).toBe(10);
  });

  test('calls SDK with custom --limit', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    await listContactPropertiesCommand.parseAsync(['--limit', '25'], { from: 'user' });

    const args = mockList.mock.calls[0][0] as any;
    expect(args.limit).toBe(25);
  });

  test('calls SDK with --after cursor', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    await listContactPropertiesCommand.parseAsync(['--after', 'prop_cursor_xyz'], { from: 'user' });

    const args = mockList.mock.calls[0][0] as any;
    expect(args.after).toBe('prop_cursor_xyz');
  });

  test('outputs JSON list when non-interactive', async () => {
    setNonInteractive();
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    await listContactPropertiesCommand.parseAsync([], { from: 'user' });

    const output = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].key).toBe('company_name');
    expect(parsed.data[0].type).toBe('string');
  });

  test('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    try {
      await listContactPropertiesCommand.parseAsync(['--limit', '0'], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    try {
      await listContactPropertiesCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce({ data: null, error: { message: 'Server error', name: 'server_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listContactPropertiesCommand } = await import('../../../src/commands/contact-properties/list');
    try {
      await listContactPropertiesCommand.parseAsync([], { from: 'user' });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
