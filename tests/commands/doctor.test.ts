import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
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
  setupOutputSpies,
} from '../helpers';

type DomainListResult = { data: unknown; error: unknown };

let mockDomainListResult: DomainListResult | (() => Promise<DomainListResult>) =
  {
    data: { data: [{ name: 'example.com', status: 'verified' }] },
    error: null,
  };

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = {
      list: vi.fn(async () =>
        typeof mockDomainListResult === 'function'
          ? mockDomainListResult()
          : mockDomainListResult,
      ),
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
    // Isolate from the developer's real ~/.config/resend/credentials.json — the
    // Credential Storage check reads it directly. Point at a nonexistent dir so
    // readCredentials() returns null.
    process.env.XDG_CONFIG_HOME = join(
      tmpdir(),
      `resend-doctor-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  });

  afterEach(() => {
    restoreEnv();
    spies = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
  });

  it('outputs JSON with --json flag', async () => {
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

  it('JSON output has correct check structure', async () => {
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

  it('API key check passes when key is set', async () => {
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
  });

  it('API key check fails when no key is set', async () => {
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

  it('masks API key in output', async () => {
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

  it('exits with code 1 when checks fail', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';

    spies = setupOutputSpies();
    exitSpy = mockExitThrow();

    const program = await createDoctorProgram();
    await expectExit1(() =>
      program.parseAsync(['doctor', '--json'], { from: 'user' }),
    );
  });

  it('shows warn for sending-only API key instead of fail', async () => {
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

  it('warns when network is unreachable instead of reporting invalid key', async () => {
    mockDomainListResult = {
      data: null,
      error: {
        name: 'application_error',
        statusCode: null,
        message: 'Unable to fetch data. The request could not be resolved.',
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
    expect(apiCheck.message).toContain('Network error');
  });

  it('warns when domains.list times out instead of failing', async () => {
    const timeoutError = new Error('Operation timed out after 5000ms');
    timeoutError.name = 'TimeoutError';
    mockDomainListResult = () => Promise.reject(timeoutError);

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
    expect(apiCheck.message).toContain('timed out');
  });
});

describe('doctor command — expired OAuth grant', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';

    // Inline (file-fallback) grant with an expired access token, so resolving it
    // triggers a refresh. The server rejects an expired/invalid refresh token
    // with a non-OK response (mocked below).
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'staging',
        profiles: {
          staging: {
            type: 'oauth_grant',
            access_token: 'header.body.sig',
            access_token_expires_at: 1,
            refresh_token: 'rt_expired',
            scope: 'full_access',
          },
        },
      }),
    );
  });

  afterEach(async () => {
    const { rmSync } = await import('node:fs');
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    spies = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
  });

  it('fails validation (not presence) when the server rejects the refresh', async () => {
    // Server rejects the expired refresh token with invalid_grant (HTTP 400).
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
      }),
    );

    spies = setupOutputSpies();
    exitSpy = mockExitThrow();

    const program = await createDoctorProgram();
    // A rejected session is a real failure → doctor exits 1, but never crashes.
    await expectExit1(() =>
      program.parseAsync(['doctor', '--json'], { from: 'user' }),
    );

    const checks = JSON.parse(spies.logSpy.mock.calls[0][0] as string).checks;
    const find = (name: string) =>
      checks.find((c: Record<string, unknown>) => c.name === name);
    // Presence is local (no refresh) → the stored token still reads as present.
    expect(find('API Key').status).toBe('pass');
    // The rejection surfaces in validation as a hard failure.
    expect(find('API Validation').status).toBe('fail');
    expect(find('API Validation').message).toContain('resend login');

    fetchSpy.mockRestore();
  });

  it('warns (does not fail) on a transient network error during refresh', async () => {
    // Network is down — fetch rejects rather than returning a rejection response.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));

    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    // No hard failures → doctor exits 0 and prints its report.
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const checks = JSON.parse(spies.logSpy.mock.calls[0][0] as string).checks;
    const validation = checks.find(
      (c: Record<string, unknown>) => c.name === 'API Validation',
    );
    expect(validation.status).toBe('warn');

    fetchSpy.mockRestore();
  });
});

describe('doctor command — valid OAuth grant', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.RESEND_CREDENTIAL_STORE = 'file';

    // Inline grant whose access token is comfortably valid (well past the 60s
    // refresh leeway), so resolving it makes no network call and the grant flows
    // straight into the live domains.list() validation.
    const nowSeconds = Math.floor(Date.now() / 1000);
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'staging',
        profiles: {
          staging: {
            type: 'oauth_grant',
            access_token: 'header.body.sig',
            access_token_expires_at: nowSeconds + 900,
            refresh_token: 'rt_valid',
            scope: 'full_access',
          },
        },
      }),
    );
  });

  afterEach(async () => {
    const { rmSync } = await import('node:fs');
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
    spies = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
  });

  it('validates the grant against the API', async () => {
    mockDomainListResult = {
      data: { data: [{ name: 'example.com', status: 'verified' }] },
      error: null,
    };
    // Stub the network so the CLI-version check can't make a real call; a valid
    // grant needs no refresh, so this must never see a token request.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network unavailable'));

    spies = setupOutputSpies();

    const program = await createDoctorProgram();
    await program.parseAsync(['doctor', '--json'], { from: 'user' });

    const checks = JSON.parse(spies.logSpy.mock.calls[0][0] as string).checks;
    const find = (name: string) =>
      checks.find((c: Record<string, unknown>) => c.name === name);
    // A Domains result only exists if domains.list() was actually called — the
    // old short-circuit produced a bare "API Validation: OAuth grant" instead.
    expect(find('Domains')?.status).toBe('pass');

    fetchSpy.mockRestore();
  });

  it('fails when the API rejects the grant', async () => {
    mockDomainListResult = {
      data: null,
      error: { name: 'validation_error', message: 'Invalid token' },
    };

    spies = setupOutputSpies();
    exitSpy = mockExitThrow();

    const program = await createDoctorProgram();
    await expectExit1(() =>
      program.parseAsync(['doctor', '--json'], { from: 'user' }),
    );

    const checks = JSON.parse(spies.logSpy.mock.calls[0][0] as string).checks;
    const validation = checks.find(
      (c: Record<string, unknown>) => c.name === 'API Validation',
    );
    expect(validation.status).toBe('fail');
    expect(validation.message).toContain('Invalid credential');
  });
});
