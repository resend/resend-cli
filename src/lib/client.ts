import './user-agent';
import { Resend } from 'resend';
import type { ApiKeyPermission } from './config';
import {
  listProfiles,
  resolveApiKeyAsync,
  SENDING_KEY_MESSAGE,
} from './config';
import { errorMessage, outputError } from './output';

export type GlobalOpts = {
  apiKey?: string;
  json?: boolean;
  quiet?: boolean;
  profile?: string;
  /** @deprecated Use `profile` instead */
  team?: string;
};

export type RequireClientOpts = {
  permission?: ApiKeyPermission;
};

const PERMISSION_HIERARCHY: Record<ApiKeyPermission, number> = {
  sending_access: 0,
  full_access: 1,
};

function hasPermission(
  stored: ApiKeyPermission,
  required: ApiKeyPermission,
): boolean {
  return PERMISSION_HIERARCHY[stored] >= PERMISSION_HIERARCHY[required];
}

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

export async function requireClient(
  opts: GlobalOpts,
  clientOpts?: RequireClientOpts,
): Promise<Resend> {
  const profileName = opts.profile ?? opts.team;

  try {
    const resolved = await resolveApiKeyAsync(opts.apiKey, profileName);
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

    if (resolved.permission) {
      const required = clientOpts?.permission ?? 'full_access';
      if (!hasPermission(resolved.permission, required)) {
        outputError(
          {
            message: `This command requires a full access API key. Your current key has sending access only.\n${SENDING_KEY_MESSAGE}`,
            code: 'insufficient_permissions',
          },
          { json: opts.json },
        );
      }
    }

    return new Resend(resolved.key);
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
