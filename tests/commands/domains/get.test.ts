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

const mockGet = vi.fn(async () => ({
  data: {
    object: 'domain',
    id: 'test-domain-id',
    name: 'example.com',
    status: 'verified',
    created_at: '2026-01-01T00:00:00.000Z',
    region: 'us-east-1',
    records: [
      {
        record: 'SPF',
        type: 'MX',
        name: 'send',
        ttl: 'Auto',
        status: 'verified',
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
    domains = { get: mockGet };
  },
}));

describe('domains get command', () => {
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

  it('calls SDK get with correct id', async () => {
    spies = setupOutputSpies();

    const { getDomainCommand } = await import(
      '../../../src/commands/domains/get'
    );
    await getDomainCommand.parseAsync(['test-domain-id'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledWith('test-domain-id');
  });

  it('outputs full domain JSON in non-interactive mode', async () => {
    spies = setupOutputSpies();

    const { getDomainCommand } = await import(
      '../../../src/commands/domains/get'
    );
    await getDomainCommand.parseAsync(['test-domain-id'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-domain-id');
    expect(parsed.status).toBe('verified');
    expect(parsed.records).toHaveLength(1);
  });

  it('includes tracking fields in JSON output', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        object: 'domain',
        id: 'test-domain-id',
        name: 'example.com',
        status: 'verified',
        created_at: '2026-01-01T00:00:00.000Z',
        region: 'us-east-1',
        open_tracking: true,
        click_tracking: true,
        tracking_subdomain: 'track',
        records: [],
        capabilities: { sending: 'enabled', receiving: 'disabled' },
      },
      error: null,
    });
    spies = setupOutputSpies();

    const { getDomainCommand } = await import(
      '../../../src/commands/domains/get'
    );
    await getDomainCommand.parseAsync(['test-domain-id'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.open_tracking).toBe(true);
    expect(parsed.click_tracking).toBe(true);
    expect(parsed.tracking_subdomain).toBe('track');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getDomainCommand } = await import(
      '../../../src/commands/domains/get'
    );
    await expectExit1(() =>
      getDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Domain not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getDomainCommand } = await import(
      '../../../src/commands/domains/get'
    );
    await expectExit1(() =>
      getDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
