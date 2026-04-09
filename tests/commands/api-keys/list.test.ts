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
    object: 'list',
    data: [
      {
        id: 'key-id-1',
        name: 'Production Key',
        created_at: '2026-01-01T00:00:00.000Z',
        last_used_at: '2026-01-15T12:00:00.000Z',
      },
      {
        id: 'key-id-2',
        name: 'Staging Key',
        created_at: '2026-01-02T00:00:00.000Z',
        last_used_at: null,
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    apiKeys = { list: mockList };
  },
}));

describe('api-keys list command', () => {
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

  test('calls SDK list with no arguments', async () => {
    spies = setupOutputSpies();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await listApiKeysCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
  });

  test('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await listApiKeysCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0].id).toBe('key-id-1');
    expect(parsed.data[0].name).toBe('Production Key');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await expectExit1(() =>
      listApiKeysCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Unauthorized', 'unauthorized'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await expectExit1(() =>
      listApiKeysCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
