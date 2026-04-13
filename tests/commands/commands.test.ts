import { Command } from '@commander-js/extra-typings';
import { afterEach, describe, expect, test } from 'vitest';
import { listCommandsCommand } from '../../src/commands/commands';
import { captureTestEnv, setupOutputSpies } from '../helpers';

describe('commands', () => {
  const restoreEnv = captureTestEnv();

  afterEach(() => {
    restoreEnv();
  });

  test('prints JSON tree with root name and subcommands', async () => {
    const spies = setupOutputSpies();
    const program = new Command('resend')
      .description('Resend CLI')
      .option('--json', 'JSON output')
      .addCommand(new Command('emails').description('Emails'))
      .addCommand(new Command('domains').description('Domains'))
      .addCommand(listCommandsCommand);

    await program.parseAsync(['commands'], { from: 'user' });

    const tree = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(tree.name).toBe('resend');
    expect(Array.isArray(tree.subcommands)).toBe(true);
    const names = tree.subcommands.map((s: { name: string }) => s.name);
    expect(names).toContain('emails');
    expect(names).toContain('domains');
  });
});
