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

const mockCreate = vi.fn(async () => ({
  data: {
    id: 'test-domain-id',
    name: 'example.com',
    status: 'not_started',
    created_at: '2026-01-01T00:00:00.000Z',
    region: 'us-east-1',
    records: [
      {
        record: 'SPF',
        type: 'MX',
        name: 'send',
        ttl: 'Auto',
        status: 'not_started',
        value: 'feedback-smtp.us-east-1.amazonses.com',
        priority: 10,
      },
    ],
    capabilities: { sending: 'enabled', receiving: 'disabled' },
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { create: mockCreate };
  },
}));

describe('domains create command', () => {
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

  test('creates domain with --name flag', async () => {
    spies = setupOutputSpies();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await createDomainCommand.parseAsync(['--name', 'example.com'], {
      from: 'user',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.name).toBe('example.com');
  });

  test('passes region and tls flags to SDK', async () => {
    spies = setupOutputSpies();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await createDomainCommand.parseAsync(
      ['--name', 'example.com', '--region', 'eu-west-1', '--tls', 'enforced'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.region).toBe('eu-west-1');
    expect(args.tls).toBe('enforced');
  });

  test('passes receiving capability when --receiving flag is set', async () => {
    spies = setupOutputSpies();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await createDomainCommand.parseAsync(
      ['--name', 'example.com', '--receiving'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.capabilities?.receiving).toBe('enabled');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await createDomainCommand.parseAsync(['--name', 'example.com'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-domain-id');
    expect(parsed.name).toBe('example.com');
  });

  test('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await expectExit1(() =>
      createDomainCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await expectExit1(() =>
      createDomainCommand.parseAsync(['--name', 'example.com'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Domain already exists', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createDomainCommand } = await import(
      '../../../src/commands/domains/create'
    );
    await expectExit1(() =>
      createDomainCommand.parseAsync(['--name', 'example.com'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
