import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExecFileCallback = (
  err: { code: number } | null,
  stdout: string,
  stderr: string,
) => void;

vi.mock('node:child_process', () => {
  const mockExecFile = vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb: ExecFileCallback) => {
      cb(null, '', '');
    },
  );

  const mockSpawn = vi.fn(() => ({
    stdin: { on: vi.fn(), write: vi.fn(), end: vi.fn() },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 0);
      }
    }),
  }));

  return { execFile: mockExecFile, spawn: mockSpawn };
});

describe('LinuxBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns credential when secret-tool exits with 0 and has output', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as ExecFileCallback)(null, 're_my_key\n', '');
        return undefined as never;
      },
    );
    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    const result = await backend.get('resend-cli', 'default');
    expect(result).toBe('re_my_key');
  });

  it('returns null when secret-tool exits with 0 but has no output', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as ExecFileCallback)(null, '', '');
        return undefined as never;
      },
    );
    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    const result = await backend.get('resend-cli', 'default');
    expect(result).toBeNull();
  });

  it('returns null when secret-tool exits with 1 (credential not found)', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as ExecFileCallback)({ code: 1 }, '', '');
        return undefined as never;
      },
    );
    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    const result = await backend.get('resend-cli', 'default');
    expect(result).toBeNull();
  });

  it('throws when secret-tool exits with unexpected code', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as ExecFileCallback)({ code: 5 }, '', 'dbus timeout');
        return undefined as never;
      },
    );
    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    await expect(backend.get('resend-cli', 'default')).rejects.toThrow(
      'Failed to read from Secret Service (exit code 5): dbus timeout',
    );
  });

  it('throws when secret-tool exits with null code (killed/timeout)', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        (cb as ExecFileCallback)(
          { code: null as unknown as number },
          '',
          'process timed out',
        );
        return undefined as never;
      },
    );
    const { LinuxBackend } = await import(
      '../../../src/lib/credential-backends/linux'
    );
    const backend = new LinuxBackend();
    await expect(backend.get('resend-cli', 'default')).rejects.toThrow(
      'Failed to read from Secret Service (exit code null)',
    );
  });
});
