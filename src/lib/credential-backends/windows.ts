import { execFileSync, execFile, spawn } from 'node:child_process';
import path from 'node:path';
import type { CredentialBackend } from '../credential-store';

const resolvePowershellPath = (): string => {
  try {
    const systemRoot = execFileSync('cmd.exe', ['/d', '/c', 'echo', '%SystemRoot%'], {
      timeout: 5000,
      windowsHide: true,
    })
      .toString()
      .trim();

    if (systemRoot && systemRoot !== '%SystemRoot%') {
      return path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    }
  } catch {
    // Fall through to hardcoded default
  }

  return 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
};

const POWERSHELL_PATH = resolvePowershellPath();

function runPowershell(
  script: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(
      POWERSHELL_PATH,
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 10000 },
      (err, stdout, stderr) => {
        const code = err && 'code' in err ? (err.code as number | null) : 0;
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
      },
    );
  });
}

function runPowershellWithStdin(
  script: string,
  stdin: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(
      POWERSHELL_PATH,
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 },
    );
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    child.stdout?.on('data', (data: Buffer) => {
      stdoutChunks.push(data.toString());
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderrChunks.push(data.toString());
    });
    child.on('close', (code) => {
      resolve({
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
        code,
      });
    });
    child.on('error', () => {
      resolve({ stdout: '', stderr: 'Failed to spawn process', code: 1 });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.write(stdin);
    child.stdin?.end();
  });
}

const psEscape = (s: string): string => s.replace(/'/g, "''");

const LOAD_VAULT = `
  try { $null = [Windows.Security.Credentials.PasswordVault] } catch {
    [void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
  }
`;

export class WindowsBackend implements CredentialBackend {
  name = 'Windows Credential Manager';
  readonly isSecure = true;

  async get(service: string, account: string): Promise<string | null> {
    const script = `${LOAD_VAULT}
      $v = New-Object Windows.Security.Credentials.PasswordVault
      try {
        $c = $v.Retrieve('${psEscape(service)}', '${psEscape(account)}')
        $c.RetrievePassword()
        Write-Output $c.Password
      } catch {
        exit 1
      }
    `;
    const { stdout, code } = await runPowershell(script);
    if (code !== 0 || !stdout.trim()) {
      return null;
    }
    return stdout.trim();
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    const removeScript = `${LOAD_VAULT}
      $v = New-Object Windows.Security.Credentials.PasswordVault
      try {
        $c = $v.Retrieve('${psEscape(service)}', '${psEscape(account)}')
        $v.Remove($c)
      } catch {}
    `;
    await runPowershell(removeScript);

    const addScript = `${LOAD_VAULT}
      $secret = [Console]::In.ReadLine()
      $v = New-Object Windows.Security.Credentials.PasswordVault
      $c = New-Object Windows.Security.Credentials.PasswordCredential('${psEscape(service)}', '${psEscape(account)}', $secret)
      $v.Add($c)
    `;
    const { code, stderr } = await runPowershellWithStdin(addScript, secret);
    if (code !== 0) {
      throw new Error(
        `Failed to store credential in Windows Credential Manager: ${stderr.trim()}`,
      );
    }
  }

  async delete(service: string, account: string): Promise<boolean> {
    const script = `${LOAD_VAULT}
      $v = New-Object Windows.Security.Credentials.PasswordVault
      try {
        $c = $v.Retrieve('${psEscape(service)}', '${psEscape(account)}')
        $v.Remove($c)
      } catch {
        exit 1
      }
    `;
    const { code } = await runPowershell(script);
    return code === 0;
  }

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return false;
    }
    const { code } = await runPowershell(
      `${LOAD_VAULT} $null = New-Object Windows.Security.Credentials.PasswordVault`,
    );
    return code === 0;
  }
}

export { POWERSHELL_PATH as _powershellPath };
