import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('setupClaudeDesktop', () => {
  const restoreEnv = captureTestEnv();
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let readFileSyncSpy: ReturnType<typeof spyOn>;
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let mkdirSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
    readFileSyncSpy = spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ preferences: { menuBarEnabled: false } }),
    );
    writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    mkdirSyncSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
    mkdirSyncSpy.mockRestore();
  });

  test('merges resend into mcpServers preserving existing top-level keys', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupClaudeDesktop } = await import(
        '../../../src/commands/setup/claude-desktop'
      );
      await setupClaudeDesktop({ json: true });

      const written = JSON.parse(writeFileSyncSpy.mock.calls[0][1] as string);
      expect(written.preferences).toBeDefined();
      expect(written.mcpServers.resend.command).toBe('npx');
      expect(written.mcpServers.resend.args).toEqual(['-y', 'resend-mcp']);
      expect(typeof written.mcpServers.resend.env.RESEND_API_KEY).toBe(
        'string',
      );
    } finally {
      restore();
    }
  });

  test('outputs JSON with configured:true and tool:claude-desktop', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupClaudeDesktop } = await import(
        '../../../src/commands/setup/claude-desktop'
      );
      await setupClaudeDesktop({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('claude-desktop');
      expect(output.config_path).toBeDefined();
    } finally {
      restore();
    }
  });

  test('calls outputError with config_write_error on failure', async () => {
    writeFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('No space');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupClaudeDesktop } = await import(
        '../../../src/commands/setup/claude-desktop'
      );
      await expectExit1(() => setupClaudeDesktop({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('config_write_error');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
