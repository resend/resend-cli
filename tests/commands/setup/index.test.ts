import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
} from '../../helpers';

describe('setup index — non-interactive guard', () => {
  const restoreEnv = captureTestEnv();
  afterEach(() => restoreEnv());

  test('errors with missing_target when run non-interactively without a subcommand', async () => {
    setNonInteractive();
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupCommand } = await import(
        '../../../src/commands/setup/index'
      );
      await expectExit1(() => setupCommand.parseAsync([], { from: 'user' }));

      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('missing_target');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  test('all five subcommands are registered on setupCommand', async () => {
    const { setupCommand } = await import('../../../src/commands/setup/index');
    const names = setupCommand.commands.map((c) => c.name());
    expect(names).toContain('cursor');
    expect(names).toContain('claude-desktop');
    expect(names).toContain('claude-code');
    expect(names).toContain('vscode');
    expect(names).toContain('openclaw');
  });
});
