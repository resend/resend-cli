import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setupOutputSpies,
} from '../../helpers';

describe('setupOpenclaw', () => {
  const restoreEnv = captureTestEnv();
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let mkdirSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    writeFileSyncSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    mkdirSyncSpy = spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv();
    writeFileSyncSpy.mockRestore();
    mkdirSyncSpy.mockRestore();
  });

  test('writes skill file to ~/.openclaw/skills/resend/SKILL.md', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupOpenclaw } = await import(
        '../../../src/commands/setup/openclaw'
      );
      await setupOpenclaw({ json: true });

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining('.openclaw/skills/resend'),
        { recursive: true },
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining('SKILL.md'),
        expect.stringContaining('# Resend CLI'),
        'utf8',
      );
    } finally {
      restore();
    }
  });

  test('skill content contains YAML frontmatter and key sections', async () => {
    const { restore } = setupOutputSpies();
    try {
      const { setupOpenclaw } = await import(
        '../../../src/commands/setup/openclaw'
      );
      await setupOpenclaw({ json: true });

      const content = writeFileSyncSpy.mock.calls[0][1] as string;
      expect(content).toContain('name: resend');
      expect(content).toContain('RESEND_API_KEY');
      expect(content).toContain('resend emails send');
      expect(content).toContain('resend doctor');
    } finally {
      restore();
    }
  });

  test('outputs JSON with config_path containing SKILL.md', async () => {
    const { logSpy, restore } = setupOutputSpies();
    try {
      const { setupOpenclaw } = await import(
        '../../../src/commands/setup/openclaw'
      );
      await setupOpenclaw({ json: true });

      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.configured).toBe(true);
      expect(output.tool).toBe('openclaw');
      expect(output.config_path).toContain('.openclaw/skills/resend/SKILL.md');
    } finally {
      restore();
    }
  });

  test('calls outputError with config_write_error on write failure', async () => {
    writeFileSyncSpy.mockImplementationOnce(() => {
      throw new Error('EACCES');
    });
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = mockExitThrow();

    try {
      const { setupOpenclaw } = await import(
        '../../../src/commands/setup/openclaw'
      );
      await expectExit1(() => setupOpenclaw({ json: true }));
      const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('config_write_error');
    } finally {
      errorSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
