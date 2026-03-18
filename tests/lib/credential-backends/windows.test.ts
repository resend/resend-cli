import { beforeEach, describe, expect, test, vi } from 'vitest';

// We mock child_process to verify stdin usage without requiring Windows
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
      on: vi.fn((_event: string, _cb: (data: Buffer) => void) => {
        // no output
      }),
    },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        // Defer to allow stdin writes to be tracked first
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

  test('set() passes secret via stdin, NOT in PowerShell script args', async () => {
    const { spawn } = await import('node:child_process');
    const { WindowsBackend } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    await backend.set('resend-cli', 'default', 're_secret_key_1234');

    // spawn is called for the add operation (second call - first is execFile for remove)
    expect(spawn).toHaveBeenCalled();
    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const script = spawnCall[1]?.[spawnCall[1].length - 1] as string;

    // The script should NOT contain the secret directly
    expect(script).not.toContain('re_secret_key_1234');
    // The script should read from stdin
    expect(script).toContain('[Console]::In.ReadLine()');

    // The secret should have been written to stdin
    const mockChild = vi.mocked(spawn).mock.results[0].value as {
      stdin: { write: ReturnType<typeof vi.fn> };
    };
    expect(mockChild.stdin.write).toHaveBeenCalledWith('re_secret_key_1234');
  });

  test('get() does not use stdin', async () => {
    const { execFile } = await import('node:child_process');
    const { WindowsBackend } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    await backend.get('resend-cli', 'default');

    // get() uses execFile, not spawn
    expect(execFile).toHaveBeenCalled();
    const args = vi.mocked(execFile).mock.calls[0][1] as string[];
    const script = args[args.length - 1];
    expect(script).toContain('Retrieve');
  });
});
