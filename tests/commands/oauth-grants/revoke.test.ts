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

const mockRevoke = vi.fn(async () => ({
  data: {
    object: 'oauth_grant',
    id: 'test-grant-id',
    revoked_at: '2026-01-03T00:00:00.000Z',
    revoked_reason: 'revoked_from_api',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    oauthGrants = { revoke: mockRevoke };
  },
}));

describe('oauth-grants revoke command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRevoke.mockClear();
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

  it('revokes an OAuth grant with the --yes flag', async () => {
    spies = setupOutputSpies();

    const { revokeOAuthGrantCommand } = await import(
      '../../../src/commands/oauth-grants/revoke'
    );
    await revokeOAuthGrantCommand.parseAsync(['test-grant-id', '--yes'], {
      from: 'user',
    });

    expect(mockRevoke).toHaveBeenCalledWith('test-grant-id');
  });

  it('outputs the revoked grant JSON on success', async () => {
    spies = setupOutputSpies();

    const { revokeOAuthGrantCommand } = await import(
      '../../../src/commands/oauth-grants/revoke'
    );
    await revokeOAuthGrantCommand.parseAsync(['test-grant-id', '--yes'], {
      from: 'user',
    });

    const output = (spies.logSpy.mock.calls[0] as unknown[])[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('oauth_grant');
    expect(parsed.id).toBe('test-grant-id');
    expect(parsed.revoked_reason).toBe('revoked_from_api');
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { revokeOAuthGrantCommand } = await import(
      '../../../src/commands/oauth-grants/revoke'
    );
    await expectExit1(() =>
      revokeOAuthGrantCommand.parseAsync(['test-grant-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  it('does not call the SDK when confirmation is required but not given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { revokeOAuthGrantCommand } = await import(
      '../../../src/commands/oauth-grants/revoke'
    );
    await expectExit1(() =>
      revokeOAuthGrantCommand.parseAsync(['test-grant-id'], { from: 'user' }),
    );

    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('errors with revoke_error when the SDK returns an error', async () => {
    setNonInteractive();
    mockRevoke.mockResolvedValueOnce(
      mockSdkError('OAuth grant not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { revokeOAuthGrantCommand } = await import(
      '../../../src/commands/oauth-grants/revoke'
    );
    await expectExit1(() =>
      revokeOAuthGrantCommand.parseAsync(['test-grant-id', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('revoke_error');
  });
});
