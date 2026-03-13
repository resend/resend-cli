import { execFile } from 'node:child_process';
import type { CredentialBackend } from '../credential-store';

function run(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout, stderr) => {
      const code = err && 'code' in err ? (err.code as number | null) : 0;
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
    });
  });
}

export class MacOSBackend implements CredentialBackend {
  name = 'macOS Keychain';
  readonly isSecure = true;

  async get(service: string, account: string): Promise<string | null> {
    const { stdout, code } = await run('/usr/bin/security', [
      'find-generic-password',
      '-s',
      service,
      '-a',
      account,
      '-w',
    ]);
    // exit code 44 = item not found
    if (code === 44 || code !== 0) {
      return null;
    }
    return stdout.trim() || null;
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    // -U updates if exists, creates if not
    const { code, stderr } = await run('/usr/bin/security', [
      'add-generic-password',
      '-s',
      service,
      '-a',
      account,
      '-w',
      secret,
      '-U',
    ]);
    if (code !== 0) {
      throw new Error(
        `Failed to store credential in macOS Keychain: ${stderr.trim()}`,
      );
    }
  }

  async delete(service: string, account: string): Promise<boolean> {
    const { code } = await run('/usr/bin/security', [
      'delete-generic-password',
      '-s',
      service,
      '-a',
      account,
    ]);
    return code === 0;
  }

  async isAvailable(): Promise<boolean> {
    return process.platform === 'darwin';
  }
}
