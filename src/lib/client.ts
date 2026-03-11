import { Resend } from 'resend';
import { resolveApiKey } from './config';
import { errorMessage, outputError } from './output';
import { VERSION } from './version';

export type GlobalOpts = {
  apiKey?: string;
  json?: boolean;
  quiet?: boolean;
  team?: string;
};

process.env.RESEND_USER_AGENT = `resend-cli:${VERSION}`;

export function createClient(flagValue?: string, teamName?: string): Resend {
  const resolved = resolveApiKey(flagValue, teamName);
  if (!resolved) {
    throw new Error(
      'No API key found. Set RESEND_API_KEY, use --api-key, or run: resend login',
    );
  }
  return new Resend(resolved.key);
}

export function requireClient(opts: GlobalOpts): Resend {
  try {
    return createClient(opts.apiKey, opts.team);
  } catch (err) {
    outputError(
      {
        message: errorMessage(err, 'Failed to create client'),
        code: 'auth_error',
      },
      { json: opts.json },
    );
  }
}
