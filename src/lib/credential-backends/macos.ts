import { execFile, spawn } from 'node:child_process';
import type { CredentialBackend } from '../credential-store';

const run = (
  cmd: string,
  args: readonly string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> =>
  new Promise((resolve) => {
    execFile(cmd, [...args], { timeout: 5000 }, (err, stdout, stderr) => {
      const code = err && 'code' in err ? (err.code as number | null) : 0;
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
    });
  });

const runWithStdin = (
  cmd: string,
  args: readonly string[],
  stdinData: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> =>
  new Promise((resolve) => {
    const child = spawn(cmd, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
    child.on('error', () => {
      resolve({ stdout: '', stderr: 'Failed to spawn process', code: 1 });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.write(stdinData);
    child.stdin?.end();
  });

const buildKeychainSetScript = (
  service: string,
  account: string,
  secret: string,
): string =>
  [
    'ObjC.import("Security");',
    `var passwordData = $(${JSON.stringify(secret)}).dataUsingEncoding($.NSUTF8StringEncoding);`,
    'var query = $.NSMutableDictionary.alloc.init;',
    'query.setObjectForKey($.kSecClassGenericPassword, $.kSecClass);',
    `query.setObjectForKey($(${JSON.stringify(service)}), $.kSecAttrService);`,
    `query.setObjectForKey($(${JSON.stringify(account)}), $.kSecAttrAccount);`,
    'var updateAttrs = $.NSMutableDictionary.alloc.init;',
    'updateAttrs.setObjectForKey(passwordData, $.kSecValueData);',
    'var status = $.SecItemUpdate(query, updateAttrs);',
    'if (status === -25300) {',
    '  query.setObjectForKey(passwordData, $.kSecValueData);',
    '  status = $.SecItemAdd(query, null);',
    '}',
    'if (status !== 0) { throw new Error("Keychain error: " + status); }',
  ].join('\n');

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
    const script = buildKeychainSetScript(service, account, secret);
    const { code, stderr } = await runWithStdin(
      '/usr/bin/osascript',
      ['-l', 'JavaScript'],
      script,
    );
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
