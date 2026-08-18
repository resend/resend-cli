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
    object: 'job_posting',
    id: 'job-posting-123',
    title: 'Support Engineer',
    department: 'Engineering',
    team: 'Support',
    location: 'Remote (Americas)',
    employment_type: 'FullTime',
    workplace_type: 'Remote',
    published_at: '2026-08-01T00:00:00.000Z',
    compensation: null,
    fields: [
      { path: 'name', title: 'Name', type: 'String', required: true },
      { path: 'email', title: 'Email', type: 'Email', required: true },
      { path: 'resume', title: 'Resume', type: 'File', required: true },
      {
        path: 'd5cef330-d154-4f3a-8c5a-092986c61fe3',
        title: 'Why do you want to join Resend?',
        type: 'LongText',
        required: true,
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

describe('careers get command', () => {
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

  it('fetches the job posting by id', async () => {
    spies = setupOutputSpies();

    const { getCareerCommand } = await import(
      '../../../src/commands/careers/get'
    );
    await getCareerCommand.parseAsync(['job-posting-123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/careers/job-posting-123');
  });

  it('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getCareerCommand } = await import(
      '../../../src/commands/careers/get'
    );
    await getCareerCommand.parseAsync(['job-posting-123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('job_posting');
    expect(parsed.fields).toHaveLength(4);
    expect(parsed.fields[3].path).toBe('d5cef330-d154-4f3a-8c5a-092986c61fe3');
  });

  it('errors with missing_id when id is absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getCareerCommand } = await import(
      '../../../src/commands/careers/get'
    );
    await expectExit1(() => getCareerCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
  });

  it('errors with fetch_error when the API returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Job posting not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getCareerCommand } = await import(
      '../../../src/commands/careers/get'
    );
    await expectExit1(() =>
      getCareerCommand.parseAsync(['job-posting-missing'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
