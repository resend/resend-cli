import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('logout command', () => {
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

  function writeCredentials(
    teams: Record<string, string> = { default: 're_test_key_123' },
  ) {
    const configDir = join(tmpDir, 'resend');
    mkdirSync(configDir, { recursive: true });
    const creds = {
      active_team: Object.keys(teams)[0],
      teams: Object.fromEntries(
        Object.entries(teams).map(([name, key]) => [name, { api_key: key }]),
      ),
    };
    writeFileSync(
      join(configDir, 'credentials.json'),
      `${JSON.stringify(creds, null, 2)}\n`,
    );
  }

  test('removes credentials file when it exists (non-interactive)', async () => {
    spies = setupOutputSpies();
    writeCredentials();

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await logoutCommand.parseAsync([], { from: 'user' });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.config_path).toContain('credentials.json');
  });

  test('exits cleanly when no credentials file exists (non-interactive)', async () => {
    spies = setupOutputSpies();

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await logoutCommand.parseAsync([], { from: 'user' });

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.already_logged_out).toBe(true);
  });

  test('logout without --team removes all teams', async () => {
    spies = setupOutputSpies();
    writeCredentials({ staging: 're_staging_key', production: 're_prod_key' });

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await logoutCommand.parseAsync([], { from: 'user' });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.team).toBe('all');
  });

  test('logout with --team removes only that team', async () => {
    spies = setupOutputSpies();
    writeCredentials({ staging: 're_staging_key', production: 're_prod_key' });

    // Use the full CLI program so --team global option is recognized
    const { Command } = await import('@commander-js/extra-typings');
    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    const program = new Command()
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .addCommand(logoutCommand);

    await program.parseAsync(['logout', '--team', 'staging'], {
      from: 'user',
    });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(true);

    const remaining = JSON.parse(
      require('node:fs').readFileSync(configPath, 'utf-8'),
    );
    expect(remaining.teams.staging).toBeUndefined();
    expect(remaining.teams.production).toBeDefined();

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.team).toBe('staging');
  });

  test('exits with error when file removal fails', async () => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    spies = setupOutputSpies();
    writeCredentials();

    // Make the credentials file a directory so unlinkSync throws
    const configPath = join(tmpDir, 'resend', 'credentials.json');
    rmSync(configPath);
    mkdirSync(configPath); // replace file with a directory — unlinkSync will throw EISDIR

    const { logoutCommand } = await import('../../../src/commands/auth/logout');
    await expectExit1(() => logoutCommand.parseAsync([], { from: 'user' }));

    expect(errorSpy).toBeDefined();
    const output = JSON.parse(errorSpy?.mock.calls[0][0] as string);
    expect(output.error.code).toBe('remove_failed');
  });
});
