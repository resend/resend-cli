import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
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

const mockRemove = vi.fn(async () => ({
  data: {
    object: 'contact' as const,
    deleted: true,
    contact: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { remove: mockRemove };
  },
}));

describe('contacts delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
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

  it('deletes contact by ID with --yes', async () => {
    spies = setupOutputSpies();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await deleteContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--yes'],
      {
        from: 'user',
      },
    );

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe(
      'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
  });

  it('deletes contact by email with --yes', async () => {
    spies = setupOutputSpies();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await deleteContactCommand.parseAsync(['jane@example.com', '--yes'], {
      from: 'user',
    });

    expect(mockRemove.mock.calls[0][0]).toBe('jane@example.com');
  });

  it('outputs synthesized JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await deleteContactCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--yes'],
      {
        from: 'user',
      },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('contact');
    expect(parsed.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(parsed.deleted).toBe(true);
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await expectExit1(() =>
      deleteContactCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  it('does not call SDK when confirmation_required error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await expectExit1(() =>
      deleteContactCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await expectExit1(() =>
      deleteContactCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--yes'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('Contact not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteContactCommand } = await import(
      '../../../src/commands/contacts/delete'
    );
    await expectExit1(() =>
      deleteContactCommand.parseAsync(['nonexistent_id', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
