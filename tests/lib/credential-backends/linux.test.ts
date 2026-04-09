import { access, constants } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  constants: { X_OK: 1 },
}));

vi.mock('node:child_process', () => {
  const mockExecFile = vi.fn(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: null, stdout: string, stderr: string) => void,
    ) => {
      cb(null, '', '');
    },
  );

  const mockStdin = {
    on: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };

  const mockSpawn = vi.fn(() => ({
    stdin: mockStdin,
    stdout: { on: vi.fn() },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 0);
      }
    }),
  }));

  return { execFile: mockExecFile, spawn: mockSpawn };
});

describe('LinuxBackend', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../src/lib/credential-backends/linux');
    mod._resolvedPaths.clear();
  });

  it('resolves secret-tool from trusted paths before falling back to which', async () => {
    vi.mocked(access).mockResolvedValueOnce(undefined);

    const { _resolveSecretTool } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const result = await _resolveSecretTool();

    expect(result).toBe('/usr/bin/secret-tool');
    expect(access).toHaveBeenCalledWith('/usr/bin/secret-tool', constants.X_OK);
  });

  it('falls back to second trusted path when first is unavailable', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined);

    const { _resolveSecretTool } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const result = await _resolveSecretTool();

    expect(result).toBe('/usr/local/bin/secret-tool');
  });

  it('falls back to /usr/bin/which when no trusted path exists', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(undefined);

    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: null, stdout: string, stderr: string) => void)(
          null,
          '/some/other/path/secret-tool\n',
          '',
        );
        return undefined as never;
      },
    );

    const { _resolveSecretTool } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const result = await _resolveSecretTool();

    expect(result).toBe('/some/other/path/secret-tool');
    expect(execFile).toHaveBeenCalledWith(
      '/usr/bin/which',
      ['secret-tool'],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('returns null when secret-tool is not found anywhere', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        const err = Object.assign(new Error('not found'), { code: 1 });
        (cb as (err: Error, stdout: string, stderr: string) => void)(
          err,
          '',
          '',
        );
        return undefined as never;
      },
    );

    const { _resolveSecretTool } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const result = await _resolveSecretTool();

    expect(result).toBeNull();
  });

  it('caches the resolved path across calls', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const { _resolveSecretTool } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const first = await _resolveSecretTool();
    const second = await _resolveSecretTool();

    expect(first).toBe('/usr/bin/secret-tool');
    expect(second).toBe('/usr/bin/secret-tool');
    expect(access).toHaveBeenCalledTimes(1);
  });

  it('get() uses absolute path for secret-tool', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: null, stdout: string, stderr: string) => void)(
          null,
          'the-secret\n',
          '',
        );
        return undefined as never;
      },
    );

    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    await backend.get('resend-cli', 'default');

    const calls = vi.mocked(execFile).mock.calls;
    const getCall = calls.find(
      (c) => Array.isArray(c[1]) && (c[1] as string[])[0] === 'lookup',
    );
    expect(getCall).toBeDefined();
    expect(getCall?.[0]).toBe('/usr/bin/secret-tool');
  });

  it('set() uses absolute path for secret-tool', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const { spawn } = await import('node:child_process');

    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    await backend.set('resend-cli', 'default', 're_test_key');

    expect(spawn).toHaveBeenCalled();
    const spawnCall = vi.mocked(spawn).mock.calls[0];
    expect(spawnCall[0]).toBe('/usr/bin/secret-tool');
  });

  it('isAvailable() uses absolute path for which', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: null, stdout: string, stderr: string) => void)(
          null,
          '',
          '',
        );
        return undefined as never;
      },
    );

    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    try {
      const { LinuxBackend } = await import(
        '../../../src/lib/credential-backends/linux'
      );
      const backend = new LinuxBackend();
      await backend.isAvailable();

      const execCalls = vi.mocked(execFile).mock.calls;
      const allCmds = execCalls.map((c) => c[0]);
      expect(allCmds.every((cmd) => (cmd as string).startsWith('/'))).toBe(
        true,
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('rejects relative paths from which output', async () => {
    vi.mocked(access)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'));

    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as (err: null, stdout: string, stderr: string) => void)(
          null,
          'secret-tool\n',
          '',
        );
        return undefined as never;
      },
    );

    const { _resolveSecretTool } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const result = await _resolveSecretTool();

    expect(result).toBeNull();
  });
});
