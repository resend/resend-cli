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

const mockVerify = vi.fn(async () => ({ data: claim, error: null }));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { claims: { verify: mockVerify } };
  },
}));

describe('domains claim verify command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockVerify.mockClear();
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

  it('calls SDK claims.verify with the domain id and outputs JSON', async () => {
    spies = setupOutputSpies();

    const { claimVerifyCommand } = await import(
      '../../../../src/commands/domains/claim/verify'
    );
    await claimVerifyCommand.parseAsync(['placeholder-id'], { from: 'user' });

    expect(mockVerify).toHaveBeenCalledWith('placeholder-id');
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('domain_claim');
    expect(parsed.domain_id).toBe('placeholder-id');
  });

  it('errors with verify_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockVerify.mockResolvedValueOnce(
      mockSdkError('Domain claim not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { claimVerifyCommand } = await import(
      '../../../../src/commands/domains/claim/verify'
    );
    await expectExit1(() =>
      claimVerifyCommand.parseAsync(['placeholder-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('verify_error');
  });
});
