import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('setupVscode', () => {
  const restoreEnv = captureTestEnv();
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let readFileSyncSpy: ReturnType<typeof spyOn>;
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let mkdirSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
    readFileSyncSpy = spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        servers: { other: { type: 'stdio', command: 'other', args: [] } },
      }),
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

  test('uses "servers" key (not "mcpServers") with npx entry', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupVscode } = await import(
        '../../../src/commands/setup/vscode'
      );
      await setupVscode({ json: true });

      const written = JSON.parse(writeFileSyncSpy.mock.calls[0][1] as string);
      expect(written.servers).toBeDefined();
      expect(written.mcpServers).toBeUndefined();
      expect(written.servers.resend.type).toBeUndefined();
      expect(written.servers.resend.command).toBe('npx');
      expect(written.servers.resend.args).toEqual(['-y', 'resend-mcp']);
      expect(typeof written.servers.resend.env.RESEND_API_KEY).toBe('string');
    } finally {
      restore();
    }
  });

  test('preserves other entries in servers object', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupVscode } = await import(
        '../../../src/commands/setup/vscode'
      );
      await setupVscode({ json: true });

      const written = JSON.parse(writeFileSyncSpy.mock.calls[0][1] as string);
      expect(written.servers.other).toBeDefined();
    } finally {
      restore();
    }
  });

  test('outputs JSON with config_path containing .vscode/mcp.json', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupVscode } = await import(
        '../../../src/commands/setup/vscode'
      );
      await setupVscode({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('vscode');
      expect(output.config_path).toContain('.vscode/mcp.json');
    } finally {
      restore();
    }
  });

  test('calls outputError with config_write_error on failure', async () => {
    writeFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('EPERM');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupVscode } = await import(
        '../../../src/commands/setup/vscode'
      );
      await expectExit1(() => setupVscode({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('config_write_error');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
