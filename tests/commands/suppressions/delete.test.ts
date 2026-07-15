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

const mockRemove = vi.fn(async () => ({
  data: { object: 'suppression', id: 'sup-1', deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    suppressions = { remove: mockRemove };
  },
}));

describe('suppressions delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
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

  it('removes a suppression by email with --yes', async () => {
    spies = setupOutputSpies();
    const { deleteSuppressionCommand } = await import(
      '../../../src/commands/suppressions/delete'
    );
    await deleteSuppressionCommand.parseAsync(['spam@example.com', '--yes'], {
      from: 'user',
    });

    expect(mockRemove).toHaveBeenCalledWith('spam@example.com');
  });

  it('outputs synthesized deleted JSON on success', async () => {
    spies = setupOutputSpies();
    const { deleteSuppressionCommand } = await import(
      '../../../src/commands/suppressions/delete'
    );
    await deleteSuppressionCommand.parseAsync(['sup-1', '--yes'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.deleted).toBe(true);
    expect(parsed.id).toBe('sup-1');
    expect(parsed.object).toBe('suppression');
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { deleteSuppressionCommand } = await import(
      '../../../src/commands/suppressions/delete'
    );
    await expectExit1(() =>
      deleteSuppressionCommand.parseAsync(['sup-1'], { from: 'user' }),
    );

    expect(mockRemove).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
  });

  it('errors with delete_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemove.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { deleteSuppressionCommand } = await import(
      '../../../src/commands/suppressions/delete'
    );
    await expectExit1(() =>
      deleteSuppressionCommand.parseAsync(['sup-1', '--yes'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('delete_error');
  });
});
