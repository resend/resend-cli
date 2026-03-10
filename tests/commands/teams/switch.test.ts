import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
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
  const { switchCommand } = await import('../../../src/commands/teams/switch');
  return new Command()
    .name('resend')
    .option('--json', 'Force JSON output')
    .option('--team <name>', 'Team profile')
    .addCommand(switchCommand);
}

describe('teams switch command', () => {
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

  test('switches active team in JSON mode', async () => {
    spies = setupOutputSpies();
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    const program = await createProgram();
    await program.parseAsync(['switch', 'staging', '--json'], { from: 'user' });

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.active_team).toBe('staging');

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(data.active_team).toBe('staging');
  });

  test('errors when name omitted in non-interactive mode', async () => {
    spies = setupOutputSpies();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    storeApiKey('re_default');

    const program = await createProgram();
    await expectExit1(() =>
      program.parseAsync(['switch', '--json'], { from: 'user' }),
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
      program.parseAsync(['switch', 'nonexistent'], { from: 'user' }),
    );

    const output = JSON.parse(errorSpy?.mock.calls[0][0] as string);
    expect(output.error.code).toBe('switch_failed');
  });
});
