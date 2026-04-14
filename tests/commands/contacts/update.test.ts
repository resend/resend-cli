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
    object: 'contact' as const,
    id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { update: mockUpdate };
  },
}));

describe('contacts update command', () => {
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

  test('updates contact by ID with --unsubscribed', async () => {
    spies = setupOutputSpies();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await updateContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--unsubscribed'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(args.unsubscribed).toBe(true);
  });

  test('updates contact by email with --no-unsubscribed', async () => {
    spies = setupOutputSpies();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await updateContactCommand.parseAsync(
      ['jane@example.com', '--no-unsubscribed'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.unsubscribed).toBe(false);
  });

  test('parses --properties JSON and passes to SDK', async () => {
    spies = setupOutputSpies();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await updateContactCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--properties',
        '{"plan":"pro"}',
      ],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.properties).toEqual({ plan: 'pro' });
  });

  test('does not include unsubscribed when neither flag is passed', async () => {
    spies = setupOutputSpies();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await updateContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.unsubscribed).toBeUndefined();
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await updateContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--unsubscribed'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(parsed.object).toBe('contact');
  });

  test('errors with invalid_properties when --properties is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await expectExit1(() =>
      updateContactCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--properties', 'bad-json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_properties');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await expectExit1(() =>
      updateContactCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--unsubscribed'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Contact not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactCommand } = await import(
      '../../../src/commands/contacts/update'
    );
    await expectExit1(() =>
      updateContactCommand.parseAsync(['nonexistent_id', '--unsubscribed'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
