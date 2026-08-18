import { mkdtempSync, writeFileSync } from 'node:fs';
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
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockGet = vi.fn();
const mockFetchRequest = vi.fn(async () => ({
  data: { success: true },
  error: null,
  headers: {},
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    get = mockGet;
    fetchRequest = mockFetchRequest;
  },
}));

const tempDir = mkdtempSync(join(tmpdir(), 'resend-cli-careers-'));
const resumePath = join(tempDir, 'resume.pdf');
writeFileSync(resumePath, '%PDF-1.4 fake');

const requiredFlags = [
  '--name',
  'Ada Lovelace',
  '--email',
  'ada@example.com',
  '--resume',
  resumePath,
];

describe('careers apply command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
    mockFetchRequest.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('submits a multipart application to /careers/:id', async () => {
    spies = setupOutputSpies();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await applyCareerCommand.parseAsync(
      [
        'job-posting-123',
        ...requiredFlags,
        '--field',
        'd5cef330-d154-4f3a-8c5a-092986c61fe3=I love email infrastructure.',
      ],
      { from: 'user' },
    );

    expect(mockFetchRequest).toHaveBeenCalledTimes(1);
    const [path, options] = mockFetchRequest.mock.calls[0] as [
      string,
      { method: string; body: FormData; headers: Record<string, string> },
    ];
    expect(path).toBe('/careers/job-posting-123');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer re_test_key');

    const form = options.body;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('name')).toBe('Ada Lovelace');
    expect(form.get('email')).toBe('ada@example.com');
    expect(form.get('d5cef330-d154-4f3a-8c5a-092986c61fe3')).toBe(
      'I love email infrastructure.',
    );

    const resume = form.get('resume');
    expect(resume).toBeInstanceOf(Blob);
    expect((resume as File).name).toBe('resume.pdf');
    expect((resume as Blob).type).toBe('application/pdf');

    // No form-definition fetch needed in non-interactive mode.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('outputs the API response as JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await applyCareerCommand.parseAsync(['job-posting-123', ...requiredFlags], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toEqual({ success: true });
  });

  it('errors with missing_id when id is absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await expectExit1(() =>
      applyCareerCommand.parseAsync([...requiredFlags], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
  });

  it.each([
    ['missing_name', ['--email', 'ada@example.com', '--resume', resumePath]],
    ['missing_email', ['--name', 'Ada Lovelace', '--resume', resumePath]],
    [
      'missing_resume',
      ['--name', 'Ada Lovelace', '--email', 'ada@example.com'],
    ],
  ])('errors with %s in non-interactive mode', async (code, flags) => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await expectExit1(() =>
      applyCareerCommand.parseAsync(['job-posting-123', ...flags], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain(code);
  });

  it('errors with invalid_field when a --field entry has no value', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await expectExit1(() =>
      applyCareerCommand.parseAsync(
        ['job-posting-123', ...requiredFlags, '--field', 'no-separator'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_field');
  });

  it('errors with file_read_error when the resume file does not exist', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await expectExit1(() =>
      applyCareerCommand.parseAsync(
        [
          'job-posting-123',
          '--name',
          'Ada Lovelace',
          '--email',
          'ada@example.com',
          '--resume',
          join(tempDir, 'missing.pdf'),
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });

  it('errors with apply_error when the API rejects the application', async () => {
    setNonInteractive();
    mockFetchRequest.mockResolvedValueOnce({
      data: null,
      // @ts-expect-error error shape mirrors the SDK's ErrorResponse
      error: {
        message:
          'An application has already been submitted for this job posting with this email address.',
        name: 'validation_error',
        statusCode: 400,
      },
      headers: {},
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await expectExit1(() =>
      applyCareerCommand.parseAsync(['job-posting-123', ...requiredFlags], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('apply_error');
    expect(output).toContain('already been submitted');
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { applyCareerCommand } = await import(
      '../../../src/commands/careers/apply'
    );
    await expectExit1(() =>
      applyCareerCommand.parseAsync(['job-posting-123', ...requiredFlags], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });
});
