import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('setupClaudeCode', () => {
  const restoreEnv = captureTestEnv();
  let execFileSyncSpy: ReturnType<typeof spyOn>;
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let readFileSyncSpy: ReturnType<typeof spyOn>;
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let mkdirSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    execFileSyncSpy = spyOn(childProcess, 'execFileSync').mockImplementation(
      () => Buffer.from(''),
    );
    existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(false);
    readFileSyncSpy = spyOn(fs, 'readFileSync').mockReturnValue('{}');
    writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    mkdirSyncSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    // Remove env key so resolveApiKey returns null → no -e flag in args
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    restoreEnv();
    execFileSyncSpy.mockRestore();
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
    mkdirSyncSpy.mockRestore();
  });

  test('calls claude mcp add with correct args on success', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupClaudeCode } = await import(
        '../../../src/commands/setup/claude-code'
      );
      await setupClaudeCode({ json: true });

      expect(execFileSyncSpy).toHaveBeenCalledWith(
        'claude',
        ['mcp', 'add', 'resend', '--', 'npx', '-y', 'resend-mcp'],
        { stdio: 'inherit' },
      );
    } finally {
      restore();
    }
  });

  test('outputs JSON method:mcp_add on success', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupClaudeCode } = await import(
        '../../../src/commands/setup/claude-code'
      );
      await setupClaudeCode({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('claude-code');
      expect(output.method).toBe('mcp_add');
    } finally {
      restore();
    }
  });

  test('falls back to writing ~/.claude.json when claude binary not found (ENOENT)', async () => {
    const notFoundErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    execFileSyncSpy.mockImplementationOnce(() => {
      throw notFoundErr;
    });
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupClaudeCode } = await import(
        '../../../src/commands/setup/claude-code'
      );
      await setupClaudeCode({ json: true });

      expect(writeFileSyncSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.method).toBe('direct_write');
      expect(output.config_path).toContain('.claude.json');
    } finally {
      restore();
    }
  });

  test('calls outputError when claude binary exists but exits non-zero', async () => {
    const spawnErr = Object.assign(new Error('Command failed'), {
      code: 1,
      status: 1,
    });
    execFileSyncSpy.mockImplementationOnce(() => {
      throw spawnErr;
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupClaudeCode } = await import(
        '../../../src/commands/setup/claude-code'
      );
      await expectExit1(() => setupClaudeCode({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('claude_mcp_add_failed');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
