import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../helpers';

describe('whoami command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_PROFILE;
    delete process.env.RESEND_TEAM;
  });

  afterEach(() => {
    restoreEnv();
    spies = undefined;
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('exits 1 when not authenticated (non-interactive)', async () => {
    spies = setupOutputSpies();
    exitSpy = mockExitThrow();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await expectExit1(() => whoamiCommand.parseAsync([], { from: 'user' }));

    const output = spies.logSpy.mock.calls[0]?.[0] as string | undefined;
    if (output) {
      const parsed = JSON.parse(output);
      expect(parsed.authenticated).toBe(false);
    }
  });

  test('shows authenticated JSON when key exists in config', async () => {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_profile: 'production',
        profiles: { production: { api_key: 're_test_key_abcd' } },
      }),
    );

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.profile).toBe('production');
    expect(parsed.api_key).toBe('re_...abcd');
    expect(parsed.source).toBe('config');
  });

  test('shows env source when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_env_key_5678';

    spies = setupOutputSpies();

    const { whoamiCommand } = await import('../../src/commands/whoami');
    await whoamiCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.source).toBe('env');
  });
});
