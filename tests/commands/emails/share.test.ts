import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const mockShare = vi.fn(async () => ({
  data: {
    object: 'email',
    id: 'test-email-id',
    url: 'https://resend.com/share/test-token',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { share: mockShare };
  },
}));

describe('emails share command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockShare.mockClear();
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

  it('calls SDK share with correct id and no options', async () => {
    spies = setupOutputSpies();

    const { shareCommand } = await import('../../../src/commands/emails/share');
    await shareCommand.parseAsync(['test-email-id'], { from: 'user' });

    expect(mockShare).toHaveBeenCalledWith('test-email-id', undefined);
  });

  it('calls SDK share with expiresIn when --expires-in is passed', async () => {
    spies = setupOutputSpies();

    const { shareCommand } = await import('../../../src/commands/emails/share');
    await shareCommand.parseAsync(['test-email-id', '--expires-in', '1 day'], {
      from: 'user',
    });

    expect(mockShare).toHaveBeenCalledWith('test-email-id', {
      expiresIn: '1 day',
    });
  });

  it('outputs JSON object in non-interactive mode', async () => {
    spies = setupOutputSpies();

    const { shareCommand } = await import('../../../src/commands/emails/share');
    await shareCommand.parseAsync(['test-email-id'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-email-id');
    expect(parsed.object).toBe('email');
    expect(parsed.url).toBe('https://resend.com/share/test-token');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { shareCommand } = await import('../../../src/commands/emails/share');
    await expectExit1(() =>
      shareCommand.parseAsync(['test-email-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockShare.mockResolvedValueOnce(
      mockSdkError('Email not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { shareCommand } = await import('../../../src/commands/emails/share');
    await expectExit1(() =>
      shareCommand.parseAsync(['test-email-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
