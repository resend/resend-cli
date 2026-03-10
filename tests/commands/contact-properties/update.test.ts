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
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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

  test('updates property fallback value', async () => {
    spies = setupOutputSpies();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await updateContactPropertyCommand.parseAsync(
      ['prop_abc123', '--fallback-value', 'Acme Corp'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('prop_abc123');
    expect(args.fallbackValue).toBe('Acme Corp');
  });

  test('clears fallback value with --clear-fallback-value', async () => {
    spies = setupOutputSpies();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await updateContactPropertyCommand.parseAsync(
      ['prop_abc123', '--clear-fallback-value'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('prop_abc123');
    expect(args.fallbackValue).toBeNull();
  });

  test('errors with conflicting_flags when both --fallback-value and --clear-fallback-value are given', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        ['prop_abc123', '--fallback-value', 'Acme', '--clear-fallback-value'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('conflicting_flags');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await updateContactPropertyCommand.parseAsync(
      ['prop_abc123', '--fallback-value', 'Test'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('prop_abc123');
  });

  test('errors with no_changes when no flags are provided', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(['prop_abc123'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
  });

  test('does not call SDK when no_changes error is raised', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(['prop_abc123'], {
        from: 'user',
      }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        ['prop_abc123', '--fallback-value', 'Test'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Property not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        ['nonexistent_id', '--fallback-value', 'Test'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
