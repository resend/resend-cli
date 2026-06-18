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
} from '../../../helpers';

const claim = {
  object: 'domain_claim',
  id: 'claim-id',
  name: 'example.com',
  status: 'pending',
  domain_id: 'placeholder-id',
  region: 'us-east-1',
  record: {
    type: 'TXT',
    name: 'example.com',
    value: 'resend-domain-verification=3f8a1c2d4e5b6a7f8091a2b3c4d5e6f7',
    ttl: 'Auto',
  },
  blocked_reason: null,
  failure_reason: null,
  created_at: '2026-06-16T17:12:02.059593+00:00',
  expires_at: '2026-06-23T17:12:02.059593+00:00',
};

const mockCreate = vi.fn(async () => ({ data: claim, error: null }));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { claims: { create: mockCreate } };
  },
}));

describe('domains claim create command', () => {
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

  it('calls SDK claims.create and outputs the domain_claim as JSON', async () => {
    spies = setupOutputSpies();

    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await claimCreateCommand.parseAsync(['--name', 'example.com'], {
      from: 'user',
    });

    expect(mockCreate).toHaveBeenCalledWith({ name: 'example.com' });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('domain_claim');
    expect(parsed.status).toBe('pending');
    expect(parsed.domain_id).toBe('placeholder-id');
    expect(parsed.record.type).toBe('TXT');
  });

  it('errors with missing_name when --name is absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await expectExit1(() =>
      claimCreateCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('passes customReturnPath when --custom-return-path is set', async () => {
    spies = setupOutputSpies();
    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await claimCreateCommand.parseAsync(
      ['--name', 'example.com', '--custom-return-path', 'bounce'],
      { from: 'user' },
    );
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'example.com',
      customReturnPath: 'bounce',
    });
  });

  it('passes openTracking=true with --open-tracking', async () => {
    spies = setupOutputSpies();
    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await claimCreateCommand.parseAsync(
      ['--name', 'example.com', '--open-tracking'],
      { from: 'user' },
    );
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'example.com',
      openTracking: true,
    });
  });

  it('passes openTracking=false with --no-open-tracking', async () => {
    spies = setupOutputSpies();
    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await claimCreateCommand.parseAsync(
      ['--name', 'example.com', '--no-open-tracking'],
      { from: 'user' },
    );
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'example.com',
      openTracking: false,
    });
  });

  it('passes clickTracking=true with --click-tracking', async () => {
    spies = setupOutputSpies();
    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await claimCreateCommand.parseAsync(
      ['--name', 'example.com', '--click-tracking'],
      { from: 'user' },
    );
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'example.com',
      clickTracking: true,
    });
  });

  it('passes clickTracking=false with --no-click-tracking', async () => {
    spies = setupOutputSpies();
    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await claimCreateCommand.parseAsync(
      ['--name', 'example.com', '--no-click-tracking'],
      { from: 'user' },
    );
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'example.com',
      clickTracking: false,
    });
  });

  it('errors with create_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Domain is not available to claim', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { claimCreateCommand } = await import(
      '../../../../src/commands/domains/claim/create'
    );
    await expectExit1(() =>
      claimCreateCommand.parseAsync(['--name', 'example.com'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
