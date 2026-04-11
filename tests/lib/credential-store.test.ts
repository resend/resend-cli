import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTestEnv } from '../helpers';

describe('getCredentialBackend', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_CREDENTIAL_STORE;
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('returns FileBackend when override is "file"', async () => {
    process.env.RESEND_CREDENTIAL_STORE = 'file';
    const { getCredentialBackend } = await import(
      '../../src/lib/credential-store'
    );
    const backend = await getCredentialBackend();
    expect(backend.isSecure).toBe(false);
    expect(backend.name).toBe('plaintext file');
  });

  it('throws when override is "secure_storage" and no OS backend is available', async () => {
    process.env.RESEND_CREDENTIAL_STORE = 'secure_storage';
    const { getCredentialBackend } = await import(
      '../../src/lib/credential-store'
    );
    await expect(getCredentialBackend()).rejects.toThrow(
      'Secure credential storage was requested',
    );
  });

  it('throws when override is "keychain" and no OS backend is available', async () => {
    process.env.RESEND_CREDENTIAL_STORE = 'keychain';
    const { getCredentialBackend } = await import(
      '../../src/lib/credential-store'
    );
    await expect(getCredentialBackend()).rejects.toThrow(
      'no secure backend is available',
    );
  });

  it('falls back to FileBackend when no override and no OS backend', async () => {
    const { getCredentialBackend } = await import(
      '../../src/lib/credential-store'
    );
    const backend = await getCredentialBackend();
    expect(backend.isSecure).toBe(false);
  });
});
