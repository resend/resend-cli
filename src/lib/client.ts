import './user-agent';
import { Resend } from 'resend';
import { listProfiles, resolveApiKeyAsync } from './config';
import { errorMessage, outputError } from './output';

export type GlobalOpts = {
  apiKey?: string;
  json?: boolean;
  quiet?: boolean;
  profile?: string;
  /** @deprecated Use `profile` instead */
  team?: string;
};

export async function createClient(
  flagValue?: string,
  profileName?: string,
): Promise<Resend> {
  const resolved = await resolveApiKeyAsync(flagValue, profileName);
  if (!resolved) {
    if (profileName) {
      const profiles = listProfiles();
      const exists = profiles.some((p) => p.name === profileName);
      if (!exists) {
        throw new Error(
          `Profile "${profileName}" not found. Available profiles: ${profiles.map((p) => p.name).join(', ') || '(none)'}`,
        );
      }
    }
    throw new Error(
      'No API key found. Set RESEND_API_KEY, use --api-key, or run: resend login',
    );
  }
  return new Resend(resolved.key);
}

export async function requireClient(opts: GlobalOpts): Promise<Resend> {
  try {
    return await createClient(opts.apiKey, opts.profile ?? opts.team);
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
