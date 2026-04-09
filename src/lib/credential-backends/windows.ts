import { execFile, spawn } from 'node:child_process';
import type { CredentialBackend } from '../credential-store';

function runPowershell(
  script: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
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
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 },
    );
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
    child.stdin?.on('error', () => {}); // Prevent EPIPE crash
    child.stdin?.write(stdin);
    child.stdin?.end();
  });
}

// Escape single quotes for PowerShell string literals
function psEscape(s: string): string {
  return s.replace(/'/g, "''");
}

// Snippet that ensures the WinRT PasswordVault type is loaded.
// On some environments (e.g. GitHub Actions) the type isn't available by
// default and must be explicitly loaded via its assembly-qualified name.
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
      } catch [System.Exception] {
        if ($_.Exception.Message -match 'Element not found') {
          exit 44
        }
        Write-Error $_.Exception.Message
        exit 1
      }
    `;
    const { stdout, stderr, code } = await runPowershell(script);
    if (code === 44) {
      return null;
    }
    if (code !== 0) {
      throw new Error(
        `Failed to read from Windows Credential Manager (exit code ${code}): ${stderr.trim()}`,
      );
    }
    return stdout.trim() || null;
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    // Remove existing credential first (PasswordVault throws on duplicate)
    const removeScript = `${LOAD_VAULT}
      $v = New-Object Windows.Security.Credentials.PasswordVault
      try {
        $c = $v.Retrieve('${psEscape(service)}', '${psEscape(account)}')
        $v.Remove($c)
      } catch {}
    `;
    await runPowershell(removeScript);

    // Read secret from stdin to avoid exposing it in process args
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
    // Test that PowerShell and PasswordVault are accessible
    const { code } = await runPowershell(
      `${LOAD_VAULT} $null = New-Object Windows.Security.Credentials.PasswordVault`,
    );
    return code === 0;
  }
}
