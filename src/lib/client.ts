import './user-agent';
import { Resend } from 'resend';
import type { ApiKeyPermission } from './config';
import {
  listProfiles,
  resolveAuthentication,
  SENDING_KEY_MESSAGE,
} from './config';
import { errorMessage, outputError } from './output';

export type GlobalOpts = {
  apiKey?: string;
  json?: boolean;
  quiet?: boolean;
  profile?: string;
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
  const resolved = await resolveAuthentication(flagValue, profileName);
  if (!resolved) {
    if (profileName !== undefined) {
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
  const token =
    resolved.type === 'api_key' ? resolved.key : resolved.access_token;
  return new Resend(token);
}

export async function requireClient(
  opts: GlobalOpts,
  clientOpts?: RequireClientOpts,
): Promise<Resend> {
  const profileName = opts.profile;

  try {
    const resolved = await resolveAuthentication(opts.apiKey, profileName);
    if (!resolved) {
      if (profileName !== undefined) {
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

    let storedPermission: ApiKeyPermission | undefined;
    if (resolved.type === 'api_key') {
      storedPermission = resolved.permission;
    } else {
      const scopes = resolved.scope.split(' ').filter(Boolean);
      if (scopes.includes('full_access')) {
        storedPermission = 'full_access';
      } else if (scopes.includes('emails:send')) {
        storedPermission = 'sending_access';
      } else {
        outputError(
          {
            message: `Unrecognized credential scope${resolved.scope ? ` "${resolved.scope}"` : ''}. Run \`resend login\` to re-authenticate.`,
            code: 'unrecognized_scope',
          },
          { json: opts.json },
        );
      }
    }

    if (storedPermission) {
      const required = clientOpts?.permission ?? 'full_access';
      if (!hasPermission(storedPermission, required)) {
        outputError(
          {
            message: `This command requires full access. Your current credential has sending access only.\n${SENDING_KEY_MESSAGE}`,
            code: 'insufficient_permissions',
          },
          { json: opts.json },
        );
      }
    }

    const token =
      resolved.type === 'api_key' ? resolved.key : resolved.access_token;
    return new Resend(token);
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
