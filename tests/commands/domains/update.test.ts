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

const mockUpdate = vi.fn(async () => ({
  data: { object: 'domain', id: 'test-domain-id' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { update: mockUpdate };
  },
}));

describe('domains update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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

  test('calls SDK update with correct id', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--tls', 'enforced'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('test-domain-id');
    expect(args.tls).toBe('enforced');
  });

  test('passes openTracking=true when --open-tracking is set', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--open-tracking'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.openTracking).toBe(true);
  });

  test('passes openTracking=false when --no-open-tracking is set', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--no-open-tracking'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.openTracking).toBe(false);
  });

  test('does not include tracking keys in payload when no tracking flags are passed', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--tls', 'enforced'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.openTracking).toBeUndefined();
    expect(args.clickTracking).toBeUndefined();
  });

  test('passes clickTracking=true when --click-tracking is set', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--click-tracking'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.clickTracking).toBe(true);
  });

  test('passes clickTracking=false when --no-click-tracking is set', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--no-click-tracking'],
      { from: 'user' },
    );

    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.clickTracking).toBe(false);
  });

  test('errors with no_changes when no update flags are provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await expectExit1(() =>
      updateDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('outputs domain JSON on success', async () => {
    spies = setupOutputSpies();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await updateDomainCommand.parseAsync(
      ['test-domain-id', '--tls', 'opportunistic'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('domain');
    expect(parsed.id).toBe('test-domain-id');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await expectExit1(() =>
      updateDomainCommand.parseAsync(['test-domain-id', '--tls', 'enforced'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Domain not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateDomainCommand } = await import(
      '../../../src/commands/domains/update'
    );
    await expectExit1(() =>
      updateDomainCommand.parseAsync(['test-domain-id', '--tls', 'enforced'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
