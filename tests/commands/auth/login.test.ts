import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

// Mock the Resend SDK
mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    domains = {
      list: mock(async () => ({ data: { data: [] }, error: null })),
    };
  },
}));

describe('login command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
    spies = undefined;
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('rejects key not starting with re_', async () => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() =>
      loginCommand.parseAsync(['--key', 'bad_key'], { from: 'user' }),
    );
  });

  test('stores valid key to credentials.json', async () => {
    spies = setupOutputSpies();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', 're_valid_test_key_123'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.teams.default.api_key).toBe('re_valid_test_key_123');
  });

  test('requires --key in non-interactive mode', async () => {
    spies = setupOutputSpies();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await expectExit1(() => loginCommand.parseAsync([], { from: 'user' }));

    expect(errorSpy).toBeDefined();
    const output = errorSpy?.mock.calls[0][0] as string;
    expect(output).toContain('missing_key');
  });

  test('non-interactive login stores as default when teams exist', async () => {
    // Pre-populate credentials with an existing team
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'production',
        teams: { production: { api_key: 're_old_key_1234' } },
      }),
    );

    spies = setupOutputSpies();

    const { loginCommand } = await import('../../../src/commands/auth/login');
    await loginCommand.parseAsync(['--key', 're_new_key_5678'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    // Non-interactive without --team flag stores as 'default' (no picker)
    expect(data.teams.default.api_key).toBe('re_new_key_5678');
    // Original team should still exist
    expect(data.teams.production.api_key).toBe('re_old_key_1234');
  });

  test('auto-switches to team specified via --team flag', async () => {
    spies = setupOutputSpies();

    const { Command } = await import('@commander-js/extra-typings');
    const { loginCommand } = await import('../../../src/commands/auth/login');
    const program = new Command()
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(loginCommand);

    // First store a default key
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'credentials.json'),
      JSON.stringify({
        active_team: 'default',
        teams: { default: { api_key: 're_old_key_1234' } },
      }),
    );

    await program.parseAsync(
      ['login', '--key', 're_staging_key_123', '--team', 'staging'],
      { from: 'user' },
    );

    // @ts-expect-error — reset parent to avoid polluting the shared singleton
    loginCommand.parent = null;

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_team).toBe('staging');
    expect(data.teams.staging.api_key).toBe('re_staging_key_123');
  });
});
