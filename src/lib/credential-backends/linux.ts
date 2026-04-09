import { execFile, spawn } from 'node:child_process';
import type { CredentialBackend } from '../credential-store';

function run(
  cmd: string,
  args: string[],
  options?: { timeout?: number },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: options?.timeout ?? 5000 },
      (err, stdout, stderr) => {
        const code = err && 'code' in err ? (err.code as number | null) : 0;
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
      },
    );
  });
}

function runWithStdin(
  cmd: string,
  args: string[],
  stdin: string,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'ignore', 'pipe'],
      timeout: 5000,
    });
    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    child.on('close', (code) => {
      resolve({ code, stderr });
    });
    child.on('error', () => {
      resolve({ code: 1, stderr: 'Failed to spawn process' });
    });
    child.stdin?.on('error', () => {}); // Prevent EPIPE crash
    child.stdin?.write(stdin);
    child.stdin?.end();
  });
}

export class LinuxBackend implements CredentialBackend {
  name = 'Secret Service (libsecret)';
  readonly isSecure = true;

  async get(service: string, account: string): Promise<string | null> {
    const { stdout, stderr, code } = await run('secret-tool', [
      'lookup',
      'service',
      service,
      'account',
      account,
    ]);
    if (code === 0 || code === 1) {
      return stdout.trim() || null;
    }
    throw new Error(
      `Failed to read from Secret Service (exit code ${code}): ${stderr.trim()}`,
    );
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    // Pass secret via stdin to avoid exposing in process list
    const { code, stderr } = await runWithStdin(
      'secret-tool',
      [
        'store',
        `--label=Resend CLI (${account})`,
        'service',
        service,
        'account',
        account,
      ],
      secret,
    );
    if (code !== 0) {
      throw new Error(
        `Failed to store credential in Secret Service: ${stderr.trim()}`,
      );
    }
  }

  async delete(service: string, account: string): Promise<boolean> {
    const { code } = await run('secret-tool', [
      'clear',
      'service',
      service,
      'account',
      account,
    ]);
    return code === 0;
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'linux') {
      return false;
    }
    // Check if secret-tool is installed
    const which = await run('which', ['secret-tool']);
    if (which.code !== 0) {
      return false;
    }
    // Probe the daemon with a harmless lookup (3s timeout)
    const probe = await run(
      'secret-tool',
      ['lookup', 'service', '__resend_cli_probe__'],
      { timeout: 3000 },
    );
    // exit code 0 or 1 means daemon is responding; timeout or other errors mean it's not
    return probe.code === 0 || probe.code === 1;
  }
}
