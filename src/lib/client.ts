import { Resend } from 'resend';
import { resolveApiKey } from './config';

export function createClient(flagValue?: string): Resend {
  const resolved = resolveApiKey(flagValue);
  if (!resolved) {
    throw new Error(
      'No API key found. Set RESEND_API_KEY, use --api-key, or run: resend auth login'
    );
  }
  return new Resend(resolved.key);
}
