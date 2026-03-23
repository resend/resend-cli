import { Command } from '@commander-js/extra-typings';
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
  setupOutputSpies,
} from '../helpers';

// Mock resend SDK for doctor — default: valid key with one verified domain
let mockDomainListResult: { data: unknown; error: unknown } = {
  data: { data: [{ name: 'example.com', status: 'verified' }] },
  error: null,
};

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = {
      list: vi.fn(async () => mockDomainListResult),
    };
  },
}));

/**
 * Wraps doctorCommand in a parent program with global --json option,
 * matching the real CLI structure in src/cli.ts.
 */
async function createDoctorProgram() {
  const { doctorCommand } = await import('../../src/commands/doctor');
  const program = new Command()
    .name('resend')
    .option('--json', 'Force JSON output')
    .addCommand(doctorCommand);
  return program;
}

describe('doctor command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    mockDomainListResult = {
      data: { data: [{ name: 'example.com', status: 'verified' }] },
      error: null,
    };
    process.env.RESEND_API_KEY = 're_test_key_for_doctor';
  });

  afterEach(() => {
    restoreEnv();
    spies = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
  });

  test('outputs JSON with --json flag', async () => {
    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    expect(spies.logSpy).toHaveBeenCalled();
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty('ok');
    expect(parsed).toHaveProperty('checks');
    expect(Array.isArray(parsed.checks)).toBe(true);
  });

  test('JSON output has correct check structure', async () => {
    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    for (const check of parsed.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('message');
      expect(['pass', 'warn', 'fail']).toContain(check.status);
    }
  });

  test('API key check passes when key is set', async () => {
    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    const keyCheck = parsed.checks.find(
      (c: Record<string, unknown>) => c.name === 'API Key',
    );

    expect(keyCheck).toBeDefined();
    expect(keyCheck.status).toBe('pass');
    expect(keyCheck.message).toContain('re_');
    expect(keyCheck.message).toContain('env');
  });

  test('API key check fails when no key is set', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';

    spies = setupOutputSpies();
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.ok).toBe(false);
    const keyCheck = parsed.checks.find(
      (c: Record<string, unknown>) => c.name === 'API Key',
    );
    expect(keyCheck.status).toBe('fail');
  });

  test('masks API key in output', async () => {
    process.env.RESEND_API_KEY = 're_abcdefghijklmnop';
    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    const keyCheck = parsed.checks.find(
      (c: Record<string, unknown>) => c.name === 'API Key',
    );

    // Should not contain full key
    expect(keyCheck.message).not.toContain('re_abcdefghijklmnop');
    // Should contain masked version (re_...mnop)
    expect(keyCheck.message).toContain('re_');
    expect(keyCheck.message).toContain('...');
  });

  test('exits with code 1 when checks fail', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';

    spies = setupOutputSpies();
    exitSpy = mockExitThrow();

    const program = await createDoctorProgram();
    await expectExit1(() =>
      program.parseAsync(['doctor', '--json'], { from: 'user' }),
    );
  });

  test('shows warn for sending-only API key instead of fail', async () => {
    mockDomainListResult = {
      data: null,
      error: {
        statusCode: 401,
        message: 'This API key is restricted to only send emails',
        name: 'restricted_api_key',
      },
    };

    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    const apiCheck = parsed.checks.find(
      (c: Record<string, unknown>) => c.name === 'API Validation',
    );
    expect(apiCheck).toBeDefined();
    expect(apiCheck.status).toBe('warn');
    expect(apiCheck.message).toContain('Sending-only API key');
  });
});
