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
        id: 'domain-1',
        name: 'example.com',
        status: 'verified',
        region: 'us-east-1',
        created_at: '2026-01-01T00:00:00.000Z',
        capabilities: { sending: 'enabled', receiving: 'disabled' },
      },
      {
        id: 'domain-2',
        name: 'test.com',
        status: 'pending',
        region: 'eu-west-1',
        created_at: '2026-01-02T00:00:00.000Z',
        capabilities: { sending: 'enabled', receiving: 'disabled' },
      },
    ],
    has_more: false,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { list: mockList };
  },
}));

describe('domains list command', () => {
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

  test('calls SDK list and outputs domains as JSON', async () => {
    spies = setupOutputSpies();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await listDomainsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(2);
  });

  test('passes limit to SDK', async () => {
    spies = setupOutputSpies();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await listDomainsCommand.parseAsync(['--limit', '25'], { from: 'user' });

    expect(getFirstCallArgs()).toMatchObject({ limit: 25 });
  });

  test('passes after cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await listDomainsCommand.parseAsync(['--after', 'some-cursor'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({
      after: 'some-cursor',
    });
  });

  test('passes before cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await listDomainsCommand.parseAsync(['--before', 'some-cursor'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({
      before: 'some-cursor',
    });
  });

  test('errors when both after and before cursors are provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await expectExit1(() =>
      listDomainsCommand.parseAsync(
        ['--after', 'cursor_after', '--before', 'cursor_before'],
        { from: 'user' },
      ),
    );

    expect(mockList).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_pagination');
  });

  test('uses default limit of 10 when not specified', async () => {
    spies = setupOutputSpies();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await listDomainsCommand.parseAsync([], { from: 'user' });

    expect(getFirstCallArgs()).toMatchObject({ limit: 10 });
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await expectExit1(() =>
      listDomainsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(mockSdkError('Unauthorized', 'auth_error'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listDomainsCommand } = await import(
      '../../../src/commands/domains/list'
    );
    await expectExit1(() =>
      listDomainsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
