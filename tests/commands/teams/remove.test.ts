import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { storeApiKey } from '../../../src/lib/config';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

async function createProgram() {
  const { removeCommand } = await import('../../../src/commands/teams/remove');
  return new Command()
    .name('resend')
    .option('--json', 'Force JSON output')
    .option('--team <name>', 'Team profile')
    .addCommand(removeCommand);
}

describe('teams remove command', () => {
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

  test('removes team in JSON mode', async () => {
    spies = setupOutputSpies();
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    const program = await createProgram();
    await program.parseAsync(['remove', 'staging', '--json'], { from: 'user' });

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.removed_team).toBe('staging');
  });

  test('deletes credentials file when last team removed', async () => {
    spies = setupOutputSpies();
    storeApiKey('re_only', 'only');

    const program = await createProgram();
    await program.parseAsync(['remove', 'only', '--json'], { from: 'user' });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);
  });

  test('errors when name omitted in non-interactive mode', async () => {
    spies = setupOutputSpies();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    storeApiKey('re_default');

    const program = await createProgram();
    await expectExit1(() =>
      program.parseAsync(['remove', '--json'], { from: 'user' }),
    );

    const output = JSON.parse(errorSpy?.mock.calls[0][0] as string);
    expect(output.error.code).toBe('missing_name');
  });

  test('errors when team does not exist', async () => {
    spies = setupOutputSpies();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    storeApiKey('re_default');

    const program = await createProgram();
    await expectExit1(() =>
      program.parseAsync(['remove', 'nonexistent'], { from: 'user' }),
    );

    const output = JSON.parse(errorSpy?.mock.calls[0][0] as string);
    expect(output.error.code).toBe('remove_failed');
  });
});
