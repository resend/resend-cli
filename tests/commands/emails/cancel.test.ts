import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const mockCancel = vi.fn(async () => ({
  data: { object: 'email', id: 'test-email-id' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { cancel: mockCancel };
  },
}));

describe('emails cancel command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCancel.mockClear();
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

  test('calls SDK cancel with correct id', async () => {
    spies = setupOutputSpies();

    const { cancelCommand } = await import(
      '../../../src/commands/emails/cancel'
    );
    await cancelCommand.parseAsync(['test-email-id'], { from: 'user' });

    expect(mockCancel).toHaveBeenCalledWith('test-email-id');
  });

  test('outputs JSON object in non-interactive mode', async () => {
    spies = setupOutputSpies();

    const { cancelCommand } = await import(
      '../../../src/commands/emails/cancel'
    );
    await cancelCommand.parseAsync(['test-email-id'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-email-id');
    expect(parsed.object).toBe('email');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { cancelCommand } = await import(
      '../../../src/commands/emails/cancel'
    );
    await expectExit1(() =>
      cancelCommand.parseAsync(['test-email-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with cancel_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCancel.mockResolvedValueOnce(
      mockSdkError('Email not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { cancelCommand } = await import(
      '../../../src/commands/emails/cancel'
    );
    await expectExit1(() =>
      cancelCommand.parseAsync(['test-email-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('cancel_error');
  });
});
