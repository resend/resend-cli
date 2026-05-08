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

const mockCreate = vi.fn(async () => ({
  data: { id: 'top_abc123' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    topics = { create: mockCreate };
  },
}));

describe('topics create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
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

  it('creates topic with --name and default subscription', async () => {
    spies = setupOutputSpies();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await createTopicCommand.parseAsync(['--name', 'Product Updates'], {
      from: 'user',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.name).toBe('Product Updates');
    expect(args.defaultSubscription).toBe('opt_in');
  });

  it('creates topic with explicit --default-subscription opt_out', async () => {
    spies = setupOutputSpies();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await createTopicCommand.parseAsync(
      ['--name', 'Weekly Digest', '--default-subscription', 'opt_out'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.defaultSubscription).toBe('opt_out');
  });

  it('includes description when --description is provided', async () => {
    spies = setupOutputSpies();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await createTopicCommand.parseAsync(
      [
        '--name',
        'Product Updates',
        '--description',
        'Get notified about new features',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.description).toBe('Get notified about new features');
  });

  it('outputs JSON with id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await createTopicCommand.parseAsync(['--name', 'Product Updates'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('top_abc123');
  });

  it('errors with missing_name in non-interactive mode when --name absent', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await expectExit1(() =>
      createTopicCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('does not call SDK when missing_name error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await expectExit1(() =>
      createTopicCommand.parseAsync([], { from: 'user' }),
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await expectExit1(() =>
      createTopicCommand.parseAsync(['--name', 'Test'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Topic already exists', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createTopicCommand } = await import(
      '../../../src/commands/topics/create'
    );
    await expectExit1(() =>
      createTopicCommand.parseAsync(['--name', 'Product Updates'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
