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

const mockAdd = vi.fn(async () => ({
  data: { object: 'suppression', id: 'sup-1' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    suppressions = { add: mockAdd };
  },
}));

describe('suppressions add command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockAdd.mockClear();
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

  it('suppresses the email passed as an argument', async () => {
    spies = setupOutputSpies();
    const { addSuppressionCommand } = await import(
      '../../../src/commands/suppressions/add'
    );
    await addSuppressionCommand.parseAsync(['spam@example.com'], {
      from: 'user',
    });

    expect(mockAdd).toHaveBeenCalledWith({ email: 'spam@example.com' });
  });

  it('outputs the created suppression JSON when non-interactive', async () => {
    spies = setupOutputSpies();
    const { addSuppressionCommand } = await import(
      '../../../src/commands/suppressions/add'
    );
    await addSuppressionCommand.parseAsync(['spam@example.com'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('suppression');
    expect(parsed.id).toBe('sup-1');
  });

  it('errors with missing_email when no email in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addSuppressionCommand } = await import(
      '../../../src/commands/suppressions/add'
    );
    await expectExit1(() =>
      addSuppressionCommand.parseAsync([], { from: 'user' }),
    );

    expect(mockAdd).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_email');
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockAdd.mockResolvedValueOnce(mockSdkError('Boom', 'server_error'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { addSuppressionCommand } = await import(
      '../../../src/commands/suppressions/add'
    );
    await expectExit1(() =>
      addSuppressionCommand.parseAsync(['spam@example.com'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
