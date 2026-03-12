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

const mockRemove = vi.fn(async () => ({
  data: {
    object: 'broadcast' as const,
    id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    deleted: true,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { remove: mockRemove };
  },
}));

describe('broadcasts delete command', () => {
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

  test('deletes broadcast with --yes flag', async () => {
    spies = setupOutputSpies();

    const { deleteBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/delete'
    );
    await deleteBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--yes'],
      {
        from: 'user',
      },
    );

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { deleteBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/delete'
    );
    await deleteBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--yes'],
      {
        from: 'user',
      },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.deleted).toBe(true);
    expect(parsed.id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(parsed.object).toBe('broadcast');
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/delete'
    );
    await expectExit1(() =>
      deleteBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('does not call SDK when confirmation_required error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/delete'
    );
    await expectExit1(() =>
      deleteBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/delete'
    );
    await expectExit1(() =>
      deleteBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--yes'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('Cannot delete sent broadcast', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/delete'
    );
    await expectExit1(() =>
      deleteBroadcastCommand.parseAsync(
        ['s1e2n3t4-5a6b-7c8d-9e0f-a1b2c3d4e5f6', '--yes'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
