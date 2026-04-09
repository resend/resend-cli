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
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: '3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
        created_at: '2024-11-01T18:10:00.000Z',
        endpoint: '/emails',
        method: 'POST',
        response_status: 200,
        user_agent: 'resend-node:4.0.0',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    logs = { list: mockList };
  },
}));

describe('logs list command', () => {
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

  test('calls SDK list method with default pagination', async () => {
    spies = setupOutputSpies();

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await listLogsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(10);
  });

  test('passes --limit to pagination options', async () => {
    spies = setupOutputSpies();

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await listLogsCommand.parseAsync(['--limit', '5'], { from: 'user' });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(5);
  });

  test('passes --after cursor to pagination options', async () => {
    spies = setupOutputSpies();

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await listLogsCommand.parseAsync(
      ['--after', '3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55'],
      { from: 'user' },
    );

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.after).toBe('3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55');
  });

  test('outputs JSON list with log data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await listLogsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].id).toBe('3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55');
    expect(parsed.data[0].endpoint).toBe('/emails');
    expect(parsed.has_more).toBe(false);
  });

  test('errors with invalid_limit for out-of-range limit', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await expectExit1(() =>
      listLogsCommand.parseAsync(['--limit', '200'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await expectExit1(() => listLogsCommand.parseAsync([], { from: 'user' }));

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

    const { listLogsCommand } = await import('../../../src/commands/logs/list');
    await expectExit1(() => listLogsCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
