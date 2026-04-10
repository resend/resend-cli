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

describe('MacOSBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('set() passes secret via stdin to osascript, NOT in process args', async () => {
    const { spawn } = await import('node:child_process');
    const { MacOSBackend } = await import(
      '../../../src/lib/credential-backends/macos'
    );
    const backend = new MacOSBackend();

    await backend.set('resend-cli', 'default', 're_secret_key_1234');

    expect(spawn).toHaveBeenCalled();
    const spawnCall = vi.mocked(spawn).mock.calls[0];
    const cmd = spawnCall[0] as string;
    const args = spawnCall[1] as string[];

    expect(cmd).toBe('/usr/bin/osascript');
    expect(args).toContain('-l');
    expect(args).toContain('JavaScript');

    expect(args).not.toContain('re_secret_key_1234');

    const mockChild = vi.mocked(spawn).mock.results[0].value as {
      stdin: { write: ReturnType<typeof vi.fn> };
    };
    const writtenScript = mockChild.stdin.write.mock.calls[0][0] as string;
    expect(writtenScript).toContain('SecItemUpdate');
    expect(writtenScript).toContain('SecItemAdd');
    expect(writtenScript).toContain('re_secret_key_1234');
  });

  it('set() includes service and account in the JXA script', async () => {
    const { spawn } = await import('node:child_process');
    const { MacOSBackend } = await import(
      '../../../src/lib/credential-backends/macos'
    );
    const backend = new MacOSBackend();

    await backend.set('resend-cli', 'my-profile', 're_test_key');

    const mockChild = vi.mocked(spawn).mock.results[0].value as {
      stdin: { write: ReturnType<typeof vi.fn> };
    };
    const writtenScript = mockChild.stdin.write.mock.calls[0][0] as string;
    expect(writtenScript).toContain('resend-cli');
    expect(writtenScript).toContain('my-profile');
  });

  it('get() uses execFile with security command', async () => {
    const { execFile } = await import('node:child_process');
    const { MacOSBackend } = await import(
      '../../../src/lib/credential-backends/macos'
    );
    const backend = new MacOSBackend();

    await backend.get('resend-cli', 'default');

    expect(execFile).toHaveBeenCalled();
    const args = vi.mocked(execFile).mock.calls[0][1] as string[];
    expect(args).toContain('find-generic-password');
    expect(args).toContain('-w');
  });

  it('delete() uses execFile with security command', async () => {
    const { execFile } = await import('node:child_process');
    const { MacOSBackend } = await import(
      '../../../src/lib/credential-backends/macos'
    );
    const backend = new MacOSBackend();

    await backend.delete('resend-cli', 'default');

    expect(execFile).toHaveBeenCalled();
    const args = vi.mocked(execFile).mock.calls[0][1] as string[];
    expect(args).toContain('delete-generic-password');
  });
});
