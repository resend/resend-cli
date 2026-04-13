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
    has_more: false,
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

  function getFirstCallArgs(): unknown {
    const firstCall = mockList.mock.calls.at(0);
    if (!firstCall) {
      throw new Error('Expected mockList to be called at least once');
    }
    return firstCall[0];
  }

  it('uses default limit of 10 when not specified', async () => {
    spies = setupOutputSpies();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await listApiKeysCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(getFirstCallArgs()).toMatchObject({ limit: 10 });
  });

  it('outputs JSON list when non-interactive', async () => {
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

  it('passes limit to SDK', async () => {
    spies = setupOutputSpies();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await listApiKeysCommand.parseAsync(['--limit', '25'], { from: 'user' });

    expect(getFirstCallArgs()).toMatchObject({ limit: 25 });
  });

  it('passes after cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await listApiKeysCommand.parseAsync(['--after', 'some-cursor'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({
      after: 'some-cursor',
    });
  });

  it('passes before cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await listApiKeysCommand.parseAsync(['--before', 'some-cursor'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({
      before: 'some-cursor',
    });
  });

  it('errors when both after and before cursors are provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listApiKeysCommand } = await import(
      '../../../src/commands/api-keys/list'
    );
    await expectExit1(() =>
      listApiKeysCommand.parseAsync(
        ['--after', 'cursor_after', '--before', 'cursor_before'],
        { from: 'user' },
      ),
    );

    expect(mockList).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_pagination');
  });

  it('errors with auth_error when no API key', async () => {
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

  it('errors with list_error when SDK returns an error', async () => {
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
