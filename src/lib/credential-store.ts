export interface CredentialBackend {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, secret: string): Promise<void>;
  delete(service: string, account: string): Promise<boolean>;
  isAvailable(): Promise<boolean>;
  name: string;
  readonly isSecure: boolean;
}

export const SERVICE_NAME = 'resend-cli';

let cachedBackend: CredentialBackend | null = null;

export async function getCredentialBackend(): Promise<CredentialBackend> {
  if (cachedBackend) {
    return cachedBackend;
  }

  const override = process.env.RESEND_CREDENTIAL_STORE;
  if (override === 'file') {
    const { FileBackend } = await import('./credential-backends/file');
    cachedBackend = new FileBackend();
    return cachedBackend;
  }

  if (override === 'secure_storage') {
    const backend = await getOsBackend();
    if (backend) {
      cachedBackend = backend;
      return cachedBackend;
    }
    // Fall through to file if secure storage forced but unavailable
  }

  // Auto-detect: try OS backend first
  if (!override) {
    const backend = await getOsBackend();
    if (backend) {
      cachedBackend = backend;
      return cachedBackend;
    }
  }

  const { FileBackend } = await import('./credential-backends/file');
  cachedBackend = new FileBackend();
  return cachedBackend;
}

async function getOsBackend(): Promise<CredentialBackend | null> {
  if (process.platform === 'darwin') {
    const { MacOSBackend } = await import('./credential-backends/macos');
    const backend = new MacOSBackend();
    if (await backend.isAvailable()) {
      return backend;
    }
  } else if (process.platform === 'linux') {
    const { LinuxBackend } = await import('./credential-backends/linux');
    const backend = new LinuxBackend();
    if (await backend.isAvailable()) {
      return backend;
    }
  } else if (process.platform === 'win32') {
    const { WindowsBackend } = await import('./credential-backends/windows');
    const backend = new WindowsBackend();
    if (await backend.isAvailable()) {
      return backend;
    }
  }
  return null;
}

/** Reset cached backend (for testing) */
export function resetCredentialBackend(): void {
  cachedBackend = null;
}
