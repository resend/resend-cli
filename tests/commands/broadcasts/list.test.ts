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
        id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        name: 'Weekly Newsletter',
        segment_id: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        audience_id: null,
        status: 'sent' as const,
        created_at: '2026-02-18T12:00:00.000Z',
        scheduled_at: null,
        sent_at: null,
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { list: mockList };
  },
}));

describe('broadcasts list command', () => {
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

  test('lists broadcasts', async () => {
    spies = setupOutputSpies();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await listBroadcastsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
  });

  test('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await listBroadcastsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
  });

  test('passes --limit to SDK', async () => {
    spies = setupOutputSpies();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await listBroadcastsCommand.parseAsync(['--limit', '5'], { from: 'user' });

    const opts = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.limit).toBe(5);
  });

  test('passes --after cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await listBroadcastsCommand.parseAsync(
      ['--after', 'c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a4a4'],
      {
        from: 'user',
      },
    );

    const opts = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.after).toBe('c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a4a4');
  });

  test('passes --before cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await listBroadcastsCommand.parseAsync(
      ['--before', 'c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a4a4'],
      {
        from: 'user',
      },
    );

    const opts = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.before).toBe('c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a4a4');
  });

  test('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await expectExit1(() =>
      listBroadcastsCommand.parseAsync(['--limit', '999'], { from: 'user' }),
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

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await expectExit1(() =>
      listBroadcastsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Internal server error', 'server_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listBroadcastsCommand } = await import(
      '../../../src/commands/broadcasts/list'
    );
    await expectExit1(() =>
      listBroadcastsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
