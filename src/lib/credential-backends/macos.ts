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
    const { stdout, stderr, code } = await run('/usr/bin/security', [
      'find-generic-password',
      '-s',
      service,
      '-a',
      account,
      '-w',
    ]);
    if (code === 44) {
      return null;
    }
    if (code !== 0) {
      throw new Error(
        `Failed to read from macOS Keychain (exit code ${code}): ${stderr.trim()}`,
      );
    }
    return stdout.trim() || null;
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    // Note: The macOS `security` command does not support reading passwords from
    // stdin — `-w` without a value triggers an interactive TTY prompt, and `-X`
    // (hex) is still a CLI arg visible in `ps`. There is no safe way to pass the
    // secret without it appearing briefly in the process list during the execFile
    // call (~5s timeout). This is the same approach used by tools like `gh`
    // (GitHub CLI) and `1password-cli` when interacting with the macOS keychain
    // via the `security` command.
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
