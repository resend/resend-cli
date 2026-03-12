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
  data: { id: 'top_abc123' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    topics = { update: mockUpdate };
  },
}));

describe('topics update command', () => {
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

  test('calls SDK with id and name when --name is provided', async () => {
    spies = setupOutputSpies();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await updateTopicCommand.parseAsync(
      ['top_abc123', '--name', 'Security Alerts'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.id).toBe('top_abc123');
    expect(payload.name).toBe('Security Alerts');
  });

  test('calls SDK with id and description when --description is provided', async () => {
    spies = setupOutputSpies();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await updateTopicCommand.parseAsync(
      ['top_abc123', '--description', 'Updated desc'],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.id).toBe('top_abc123');
    expect(payload.description).toBe('Updated desc');
    expect(payload.name).toBeUndefined();
  });

  test('outputs JSON with id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await updateTopicCommand.parseAsync(
      ['top_abc123', '--name', 'Security Alerts'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('top_abc123');
  });

  test('errors with no_changes when neither --name nor --description provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await expectExit1(() =>
      updateTopicCommand.parseAsync(['top_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
  });

  test('does not call SDK when no_changes error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await expectExit1(() =>
      updateTopicCommand.parseAsync(['top_abc123'], { from: 'user' }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await expectExit1(() =>
      updateTopicCommand.parseAsync(['top_abc123', '--name', 'Test'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Topic not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateTopicCommand } = await import(
      '../../../src/commands/topics/update'
    );
    await expectExit1(() =>
      updateTopicCommand.parseAsync(['top_nonexistent', '--name', 'Test'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
