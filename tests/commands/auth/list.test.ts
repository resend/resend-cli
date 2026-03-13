import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { storeApiKey } from '../../../src/lib/config';
import { captureTestEnv, setupOutputSpies } from '../../helpers';

async function createProgram() {
  const { listCommand } = await import('../../../src/commands/auth/list');
  return new Command()
    .name('resend')
    .option('--json', 'Force JSON output')
    .option('--profile <name>', 'Profile')
    .addCommand(listCommand);
}

describe('auth list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
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
    spies = undefined;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('lists profiles in JSON mode', async () => {
    spies = setupOutputSpies();
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    const program = await createProgram();
    await program.parseAsync(['list', '--json'], { from: 'user' });

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.profiles).toEqual([
      { name: 'default', active: true },
      { name: 'staging', active: false },
    ]);
  });

  test('shows message when no profiles configured', async () => {
    spies = setupOutputSpies();

    const program = await createProgram();
    await program.parseAsync(['list'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    expect(output).toContain('No profiles configured');
  });
});
