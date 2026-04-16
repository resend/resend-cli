import { execFile, spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import type { CredentialBackend } from '../credential-store';

const TRUSTED_SECRET_TOOL_PATHS = [
  '/usr/bin/secret-tool',
  '/usr/local/bin/secret-tool',
  '/bin/secret-tool',
] as const;

const resolvedPaths = new Map<string, string>();

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
    const chunks: string[] = [];
    child.stderr?.on('data', (data: Buffer) => {
      chunks.push(data.toString());
    });
    child.on('close', (code) => {
      resolve({ code, stderr: chunks.join('') });
    });
    child.on('error', () => {
      resolve({ code: 1, stderr: 'Failed to spawn process' });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.write(stdin);
    child.stdin?.end();
  });
}

const findExecutableInTrustedPaths = async (
  candidates: readonly string[],
): Promise<string | null> => {
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
};

const resolveSecretTool = async (): Promise<string | null> => {
  const cached = resolvedPaths.get('secret-tool');
  if (cached) {
    return cached;
  }

  const trusted = await findExecutableInTrustedPaths(TRUSTED_SECRET_TOOL_PATHS);
  if (trusted) {
    resolvedPaths.set('secret-tool', trusted);
    return trusted;
  }

  const { stdout, code } = await run('/usr/bin/which', ['secret-tool']);
  if (code === 0) {
    const resolved = stdout.trim();
    if (resolved && resolved.startsWith('/')) {
      try {
        await access(resolved, constants.X_OK);
        resolvedPaths.set('secret-tool', resolved);
        return resolved;
      } catch {}
    }
  }

  return null;
};

const requireSecretTool = async (): Promise<string> => {
  const resolved = await resolveSecretTool();
  if (!resolved) {
    throw new Error(
      'secret-tool not found in trusted paths (/usr/bin, /usr/local/bin, /bin)',
    );
  }
  return resolved;
};

export class LinuxBackend implements CredentialBackend {
  name = 'Secret Service (libsecret)';
  readonly isSecure = true;

  async get(service: string, account: string): Promise<string | null> {
    const cmd = await requireSecretTool();
    const { stdout, code } = await run(cmd, [
      'lookup',
      'service',
      service,
      'account',
      account,
    ]);
    if (code !== 0 || !stdout.trim()) {
      return null;
    }
    return stdout.trim();
  }

  async set(service: string, account: string, secret: string): Promise<void> {
    const cmd = await requireSecretTool();
    const { code, stderr } = await runWithStdin(
      cmd,
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
    const cmd = await requireSecretTool();
    const { code } = await run(cmd, [
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
    const secretTool = await resolveSecretTool();
    if (!secretTool) {
      return false;
    }
    const probe = await run(
      secretTool,
      ['lookup', 'service', '__resend_cli_probe__'],
      { timeout: 3000 },
    );
    return probe.code === 0 || probe.code === 1;
  }
}

export {
  resolvedPaths as _resolvedPaths,
  resolveSecretTool as _resolveSecretTool,
};
