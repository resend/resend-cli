import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('setupCursor', () => {
  const restoreEnv = captureTestEnv();
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let readFileSyncSpy: ReturnType<typeof spyOn>;
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let mkdirSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
    readFileSyncSpy = spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ mcpServers: { other: { command: 'other' } } }),
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

  test('merges resend into existing mcpServers without clobbering other entries', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupCursor } = await import(
        '../../../src/commands/setup/cursor'
      );
      await setupCursor({ json: true });

      const written = JSON.parse(writeFileSyncSpy.mock.calls[0][1] as string);
      expect(written.mcpServers.other).toBeDefined();
      expect(written.mcpServers.resend.command).toBe('npx');
      expect(written.mcpServers.resend.args).toEqual(['-y', 'resend-mcp']);
      expect(typeof written.mcpServers.resend.env.RESEND_API_KEY).toBe(
        'string',
      );
    } finally {
      restore();
    }
  });

  test('creates config from scratch when file does not exist', async () => {
    existsSyncSpy.mockReturnValueOnce(false);
    const { restore } = setupOutputSpies();
    try {
      const { setupCursor } = await import(
        '../../../src/commands/setup/cursor'
      );
      await setupCursor({ json: true });

      const written = JSON.parse(writeFileSyncSpy.mock.calls[0][1] as string);
      expect(written.mcpServers.resend.command).toBe('npx');
      expect(written.mcpServers.resend.args).toEqual(['-y', 'resend-mcp']);
    } finally {
      restore();
    }
  });

  test('outputs JSON with configured:true in non-interactive mode', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupCursor } = await import(
        '../../../src/commands/setup/cursor'
      );
      await setupCursor({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('cursor');
      expect(output.config_path).toContain('.cursor/mcp.json');
    } finally {
      restore();
    }
  });

  test('calls outputError when writeFileSync throws', async () => {
    writeFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('Permission denied');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupCursor } = await import(
        '../../../src/commands/setup/cursor'
      );
      await expectExit1(() => setupCursor({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('config_write_error');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
