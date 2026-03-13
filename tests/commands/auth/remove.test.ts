import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { storeApiKey } from '../../../src/lib/config';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

async function createProgram() {
  const { removeCommand } = await import('../../../src/commands/auth/remove');
  return new Command()
    .name('resend')
    .option('--json', 'Force JSON output')
    .option('--profile <name>', 'Profile')
    .addCommand(removeCommand);
}

describe('auth remove command', () => {
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

  test('removes profile in JSON mode', async () => {
    spies = setupOutputSpies();
    storeApiKey('re_default', 'default');
    storeApiKey('re_staging', 'staging');

    const program = await createProgram();
    await program.parseAsync(['remove', 'staging', '--json'], {
      from: 'user',
    });

    const output = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.removed_profile).toBe('staging');
  });

  test('deletes credentials file when last profile removed', async () => {
    spies = setupOutputSpies();
    storeApiKey('re_only', 'only');

    const program = await createProgram();
    await program.parseAsync(['remove', 'only', '--json'], { from: 'user' });

    const configPath = join(tmpDir, 'resend', 'credentials.json');
    expect(existsSync(configPath)).toBe(false);
  });

  test('errors when name omitted in non-interactive mode', async () => {
    spies = setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
    storeApiKey('re_default');

    const program = await createProgram();
    await expectExit1(() =>
      program.parseAsync(['remove', '--json'], { from: 'user' }),
    );

    const output = JSON.parse(errorSpy?.mock.calls[0][0] as string);
    expect(output.error.code).toBe('missing_name');
  });

  test('errors when profile does not exist', async () => {
    spies = setupOutputSpies();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
