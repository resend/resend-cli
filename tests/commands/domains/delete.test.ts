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

const mockRemove = mock(async () => ({
  data: { object: 'domain', id: 'test-domain-id', deleted: true },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = { remove: mockRemove };
  },
}));

describe('domains delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
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

  test('deletes domain with --yes flag', async () => {
    spies = setupOutputSpies();

    const { deleteDomainCommand } = await import(
      '../../../src/commands/domains/delete'
    );
    await deleteDomainCommand.parseAsync(['test-domain-id', '--yes'], {
      from: 'user',
    });

    expect(mockRemove).toHaveBeenCalledWith('test-domain-id');
  });

  test('outputs deleted domain JSON on success', async () => {
    spies = setupOutputSpies();

    const { deleteDomainCommand } = await import(
      '../../../src/commands/domains/delete'
    );
    await deleteDomainCommand.parseAsync(['test-domain-id', '--yes'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.deleted).toBe(true);
    expect(parsed.id).toBe('test-domain-id');
  });

  test('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteDomainCommand } = await import(
      '../../../src/commands/domains/delete'
    );
    await expectExit1(() =>
      deleteDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  test('does not call SDK when confirmation is required but not given', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteDomainCommand } = await import(
      '../../../src/commands/domains/delete'
    );
    await expectExit1(() =>
      deleteDomainCommand.parseAsync(['test-domain-id'], { from: 'user' }),
    );

    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteDomainCommand } = await import(
      '../../../src/commands/domains/delete'
    );
    await expectExit1(() =>
      deleteDomainCommand.parseAsync(['test-domain-id', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(
      mockSdkError('Domain not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteDomainCommand } = await import(
      '../../../src/commands/domains/delete'
    );
    await expectExit1(() =>
      deleteDomainCommand.parseAsync(['test-domain-id', '--yes'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
