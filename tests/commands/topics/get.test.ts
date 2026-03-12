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

const mockGet = vi.fn(async () => ({
  data: {
    id: 'top_abc123',
    name: 'Product Updates',
    description: 'Get notified about new features',
    default_subscription: 'opt_in' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    topics = { get: mockGet };
  },
}));

describe('topics get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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

  test('calls SDK with the provided topic ID', async () => {
    spies = setupOutputSpies();

    const { getTopicCommand } = await import(
      '../../../src/commands/topics/get'
    );
    await getTopicCommand.parseAsync(['top_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('top_abc123');
  });

  test('outputs JSON topic data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getTopicCommand } = await import(
      '../../../src/commands/topics/get'
    );
    await getTopicCommand.parseAsync(['top_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('top_abc123');
    expect(parsed.name).toBe('Product Updates');
    expect(parsed.description).toBe('Get notified about new features');
    expect(parsed.default_subscription).toBe('opt_in');
    expect(parsed.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getTopicCommand } = await import(
      '../../../src/commands/topics/get'
    );
    await expectExit1(() =>
      getTopicCommand.parseAsync(['top_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Topic not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getTopicCommand } = await import(
      '../../../src/commands/topics/get'
    );
    await expectExit1(() =>
      getTopicCommand.parseAsync(['top_nonexistent'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
