import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd, _args, _opts, cb) => cb(null)),
}));

import { execFile } from 'node:child_process';
import { openInBrowser } from '../../src/lib/browser';

const execFileMock = vi.mocked(execFile);

describe('openInBrowser', () => {
  it('uses explorer.exe on win32 to avoid cmd.exe env-var expansion', async () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      const result = await openInBrowser(
        'https://resend.com/templates/%SECRET%',
      );

      expect(result).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith(
        'explorer.exe',
        ['https://resend.com/templates/%SECRET%'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('does not pass windowsVerbatimArguments', async () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      await openInBrowser('https://resend.com/templates/abc');

      const opts = execFileMock.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(opts).not.toHaveProperty('windowsVerbatimArguments');
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('uses open on darwin', async () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    try {
      await openInBrowser('https://resend.com/templates/abc');

      expect(execFileMock).toHaveBeenCalledWith(
        'open',
        ['https://resend.com/templates/abc'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('uses xdg-open on linux', async () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    try {
      await openInBrowser('https://resend.com/templates/abc');

      expect(execFileMock).toHaveBeenCalledWith(
        'xdg-open',
        ['https://resend.com/templates/abc'],
        expect.objectContaining({ timeout: 5000 }),
        expect.any(Function),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('returns false when execFile reports an error', async () => {
    execFileMock.mockImplementationOnce((_cmd, _args, _opts, cb) => {
      (cb as (err: Error | null) => void)(new Error('fail'));
      return undefined as never;
    });

    const result = await openInBrowser('https://resend.com');

    expect(result).toBe(false);
  });
});
