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

const mockGet = vi.fn(async () => ({
  data: {
    object: 'list',
    data: [
      {
        id: 'job-posting-123',
        title: 'Support Engineer',
        department: 'Engineering',
        team: 'Support',
        location: 'Remote (Americas)',
        employment_type: 'FullTime',
        workplace_type: 'Remote',
        published_at: '2026-08-01T00:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    get = mockGet;
  },
}));

describe('careers list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('fetches open positions from /careers', async () => {
    spies = setupOutputSpies();

    const { listCareersCommand } = await import(
      '../../../src/commands/careers/list'
    );
    await listCareersCommand.parseAsync([], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/careers');
  });

  it('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listCareersCommand } = await import(
      '../../../src/commands/careers/list'
    );
    await listCareersCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].id).toBe('job-posting-123');
    expect(parsed.data[0].title).toBe('Support Engineer');
  });

  it('errors with list_error when the API returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Something went wrong', 'application_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listCareersCommand } = await import(
      '../../../src/commands/careers/list'
    );
    await expectExit1(() =>
      listCareersCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listCareersCommand } = await import(
      '../../../src/commands/careers/list'
    );
    await expectExit1(() =>
      listCareersCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });
});
