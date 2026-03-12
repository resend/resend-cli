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
  data: { object: 'topic' as const, id: 'top_abc123', deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    topics = { remove: mockRemove };
  },
}));

describe('topics delete command', () => {
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

  test('deletes topic with --yes flag', async () => {
    spies = setupOutputSpies();

    const { deleteTopicCommand } = await import(
      '../../../src/commands/topics/delete'
    );
    await deleteTopicCommand.parseAsync(['top_abc123', '--yes'], {
      from: 'user',
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove.mock.calls[0][0]).toBe('top_abc123');
  });

  test('outputs synthesized JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { deleteTopicCommand } = await import(
      '../../../src/commands/topics/delete'
    );
    await deleteTopicCommand.parseAsync(['top_abc123', '--yes'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('topic');
    expect(parsed.id).toBe('top_abc123');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteTopicCommand } = await import(
      '../../../src/commands/topics/delete'
    );
    await expectExit1(() =>
      deleteTopicCommand.parseAsync(['top_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('does not call SDK when confirmation_required error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteTopicCommand } = await import(
      '../../../src/commands/topics/delete'
    );
    await expectExit1(() =>
      deleteTopicCommand.parseAsync(['top_abc123'], { from: 'user' }),
    );

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteTopicCommand } = await import(
      '../../../src/commands/topics/delete'
    );
    await expectExit1(() =>
      deleteTopicCommand.parseAsync(['top_abc123', '--yes'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('Topic not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteTopicCommand } = await import(
      '../../../src/commands/topics/delete'
    );
    await expectExit1(() =>
      deleteTopicCommand.parseAsync(['top_nonexistent', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
