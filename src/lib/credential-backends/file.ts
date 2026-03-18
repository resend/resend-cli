import {
  readCredentials,
  removeApiKey,
  storeApiKey as storeApiKeySync,
} from '../config';
import type { CredentialBackend } from '../credential-store';

export class FileBackend implements CredentialBackend {
  name = 'plaintext file';
  readonly isSecure = false;

  async get(_service: string, account: string): Promise<string | null> {
    const creds = readCredentials();
    if (!creds) {
      return null;
    }
    return creds.profiles[account]?.api_key ?? null;
  }

  async set(_service: string, account: string, secret: string): Promise<void> {
    storeApiKeySync(secret, account);
  }

  async delete(_service: string, account: string): Promise<boolean> {
    try {
      removeApiKey(account);
      return true;
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
