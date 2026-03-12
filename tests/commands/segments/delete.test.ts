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
    object: 'segment' as const,
    id: '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    deleted: true,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    segments = { remove: mockRemove };
  },
}));

describe('segments delete command', () => {
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

  test('deletes segment with --yes flag', async () => {
    spies = setupOutputSpies();

    const { deleteSegmentCommand } = await import(
      '../../../src/commands/segments/delete'
    );
    await deleteSegmentCommand.parseAsync(
      ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', '--yes'],
      {
        from: 'user',
      },
    );

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe(
      '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    );
  });

  test('outputs synthesized JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { deleteSegmentCommand } = await import(
      '../../../src/commands/segments/delete'
    );
    await deleteSegmentCommand.parseAsync(
      ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', '--yes'],
      {
        from: 'user',
      },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('segment');
    expect(parsed.id).toBe('3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteSegmentCommand } = await import(
      '../../../src/commands/segments/delete'
    );
    await expectExit1(() =>
      deleteSegmentCommand.parseAsync(
        ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'],
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

    const { deleteSegmentCommand } = await import(
      '../../../src/commands/segments/delete'
    );
    await expectExit1(() =>
      deleteSegmentCommand.parseAsync(
        ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'],
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

    const { deleteSegmentCommand } = await import(
      '../../../src/commands/segments/delete'
    );
    await expectExit1(() =>
      deleteSegmentCommand.parseAsync(
        ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', '--yes'],
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
      mockSdkError('Segment not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteSegmentCommand } = await import(
      '../../../src/commands/segments/delete'
    );
    await expectExit1(() =>
      deleteSegmentCommand.parseAsync(
        ['00000000-0000-0000-0000-000000000000', '--yes'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
