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

const mockList = vi.fn(async () => ({
  data: {
    data: [
      {
        id: 'top_abc123',
        name: 'Product Updates',
        description: 'Get notified about new features',
        default_subscription: 'opt_in' as const,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    topics = { list: mockList };
  },
}));

describe('topics list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
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

  test('calls SDK list method', async () => {
    spies = setupOutputSpies();

    const { listTopicsCommand } = await import(
      '../../../src/commands/topics/list'
    );
    await listTopicsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
  });

  test('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listTopicsCommand } = await import(
      '../../../src/commands/topics/list'
    );
    await listTopicsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].name).toBe('Product Updates');
    expect(parsed.data[0].id).toBe('top_abc123');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listTopicsCommand } = await import(
      '../../../src/commands/topics/list'
    );
    await expectExit1(() => listTopicsCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Server error', 'server_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listTopicsCommand } = await import(
      '../../../src/commands/topics/list'
    );
    await expectExit1(() => listTopicsCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
