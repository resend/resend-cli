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

const mockUpdate = vi.fn(async () => ({
  data: {
    object: 'contact_property' as const,
    id: 'b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contactProperties = { update: mockUpdate };
  },
}));

describe('contact-properties update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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

  test('updates property fallback value', async () => {
    spies = setupOutputSpies();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await updateContactPropertyCommand.parseAsync(
      ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d', '--fallback-value', 'Acme Corp'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d');
    expect(args.fallbackValue).toBe('Acme Corp');
  });

  test('clears fallback value with --clear-fallback-value', async () => {
    spies = setupOutputSpies();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await updateContactPropertyCommand.parseAsync(
      ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d', '--clear-fallback-value'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d');
    expect(args.fallbackValue).toBeNull();
  });

  test('errors with conflicting_flags when both --fallback-value and --clear-fallback-value are given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        [
          'b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d',
          '--fallback-value',
          'Acme',
          '--clear-fallback-value',
        ],
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
      ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d', '--fallback-value', 'Test'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact_property');
    expect(parsed.id).toBe('b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d');
  });

  test('errors with no_changes when no flags are provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
  });

  test('does not call SDK when no_changes error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d'],
        {
          from: 'user',
        },
      ),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactPropertyCommand } = await import(
      '../../../src/commands/contact-properties/update'
    );
    await expectExit1(() =>
      updateContactPropertyCommand.parseAsync(
        ['b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d', '--fallback-value', 'Test'],
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
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
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
