import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    stdout: {
      on: vi.fn((_event: string, _cb: (data: Buffer) => void) => {}),
    },
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

describe('WindowsBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('set() passes secret via stdin, NOT in PowerShell script args', async () => {
    const { spawn } = await import('node:child_process');
    const { WindowsBackend } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    await backend.set('resend-cli', 'default', 're_secret_key_1234');

    expect(spawn).toHaveBeenCalled();
    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const script = spawnCall[1]?.[spawnCall[1].length - 1] as string;

    expect(script).not.toContain('re_secret_key_1234');
    expect(script).toContain('[Console]::In.ReadLine()');

    const mockChild = vi.mocked(spawn).mock.results[0].value as {
      stdin: { write: ReturnType<typeof vi.fn> };
    };
    expect(mockChild.stdin.write).toHaveBeenCalledWith('re_secret_key_1234');
  });

  it('get() does not use stdin', async () => {
    const { execFile } = await import('node:child_process');
    const { WindowsBackend } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    await backend.get('resend-cli', 'default');

    expect(execFile).toHaveBeenCalled();
    const args = vi.mocked(execFile).mock.calls[0][1] as string[];
    const script = args[args.length - 1];
    expect(script).toContain('Retrieve');
  });

  it('uses absolute path for powershell.exe based on SystemRoot', async () => {
    const { _powershellPath } = await import(
      '../../../src/lib/credential-backends/windows'
    );

    expect(_powershellPath).toMatch(
      /\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/,
    );
    expect(_powershellPath).not.toBe('powershell.exe');
  });

  it('execFile receives absolute powershell path', async () => {
    const { execFile } = await import('node:child_process');
    const { WindowsBackend, _powershellPath } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    await backend.get('resend-cli', 'default');

    const cmd = vi.mocked(execFile).mock.calls[0][0];
    expect(cmd).toBe(_powershellPath);
  });

  it('spawn receives absolute powershell path', async () => {
    const { spawn } = await import('node:child_process');
    const { WindowsBackend, _powershellPath } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    await backend.set('resend-cli', 'default', 're_test');

    const cmd = vi.mocked(spawn).mock.calls[0][0];
    expect(cmd).toBe(_powershellPath);
  });
});
