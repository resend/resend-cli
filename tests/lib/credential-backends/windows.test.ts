import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMockChild = (closeCode: number) => {
  const stdin = { on: vi.fn(), write: vi.fn(), end: vi.fn() };
  const child = {
    stdin,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => cb(closeCode), 0);
      }
    }),
  };
  return child;
};

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

  const mockSpawn = vi.fn(() => createMockChild(0));

  return { execFile: mockExecFile, spawn: mockSpawn };
});

describe('WindowsBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes secret via stdin, not in PowerShell script args', async () => {
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

  it('does not use stdin for get()', async () => {
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

  it('restores previous credential when add fails', async () => {
    const { execFile, spawn } = await import('node:child_process');
    const { WindowsBackend } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    type ExecFileCb = (...args: never) => unknown;
    vi.mocked(execFile).mockImplementation(((
      _cmd: string,
      _args: unknown,
      _opts: unknown,
      cb: ExecFileCb,
    ) => {
      const callIndex = vi.mocked(execFile).mock.calls.length - 1;
      if (callIndex === 0) {
        (cb as (e: null, o: string, e2: string) => void)(
          null,
          'previous_secret\n',
          '',
        );
      } else {
        (cb as (e: null, o: string, e2: string) => void)(null, '', '');
      }
    }) as typeof execFile);

    const failChild = createMockChild(1);
    failChild.stderr.on.mockImplementation(
      (event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') {
          cb(Buffer.from('vault error'));
        }
      },
    );
    const rollbackChild = createMockChild(0);

    vi.mocked(spawn)
      .mockReturnValueOnce(failChild as ReturnType<typeof spawn>)
      .mockReturnValueOnce(rollbackChild as ReturnType<typeof spawn>);

    await expect(
      backend.set('resend-cli', 'default', 're_new_key'),
    ).rejects.toThrow(
      'Failed to store credential in Windows Credential Manager',
    );

    expect(spawn).toHaveBeenCalledTimes(2);
    expect(rollbackChild.stdin.write).toHaveBeenCalledWith('previous_secret');
  });

  it('skips rollback when no previous credential exists', async () => {
    const { execFile, spawn } = await import('node:child_process');
    const { WindowsBackend } = await import(
      '../../../src/lib/credential-backends/windows'
    );
    const backend = new WindowsBackend();

    vi.mocked(execFile).mockImplementation(((
      _cmd: string,
      _args: unknown,
      _opts: unknown,
      cb: (...args: never) => unknown,
    ) => {
      const callIndex = vi.mocked(execFile).mock.calls.length - 1;
      if (callIndex === 0) {
        (cb as (e: { code: number }, o: string, e2: string) => void)(
          { code: 1 },
          '',
          '',
        );
      } else {
        (cb as (e: null, o: string, e2: string) => void)(null, '', '');
      }
    }) as typeof execFile);

    const failChild = createMockChild(1);
    failChild.stderr.on.mockImplementation(
      (event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') {
          cb(Buffer.from('vault error'));
        }
      },
    );

    vi.mocked(spawn).mockReturnValueOnce(failChild as ReturnType<typeof spawn>);

    await expect(
      backend.set('resend-cli', 'default', 're_new_key'),
    ).rejects.toThrow(
      'Failed to store credential in Windows Credential Manager',
    );

    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
