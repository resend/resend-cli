import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockVerify = mock(async () => ({
  data: { object: 'domain', id: 'test-domain-id' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { verify: mockVerify };
  },
}));

describe('domains verify command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockVerify.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  test('calls SDK verify with correct id', async () => {
    spies = setupOutputSpies();

    const { verifyDomainCommand } = await import(
      '../../../src/commands/domains/verify'
    );
    await verifyDomainCommand.parseAsync(['test-domain-id'], { from: 'user' });

    expect(mockVerify).toHaveBeenCalledWith('test-domain-id');
  });

  test('outputs JSON object in non-interactive mode (stdout not a TTY)', async () => {
    spies = setupOutputSpies();

    const { verifyDomainCommand } = await import(
      '../../../src/commands/domains/verify'
    );
    await verifyDomainCommand.parseAsync(['test-domain-id'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-domain-id');
    expect(parsed.object).toBe('domain');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { verifyDomainCommand } = await import(
      '../../../src/commands/domains/verify'
    );
    await expectExit1(() =>
      verifyDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with verify_error when SDK returns an error', async () => {
    setNonInteractive();
    mockVerify.mockResolvedValueOnce(
      mockSdkError('Domain not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { verifyDomainCommand } = await import(
      '../../../src/commands/domains/verify'
    );
    await expectExit1(() =>
      verifyDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('verify_error');
  });
});
