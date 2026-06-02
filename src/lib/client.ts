import './user-agent';
import { Resend } from 'resend';
import type { ApiKeyPermission } from './config';
import {
  listProfiles,
  resolveApiKeyAsync,
  SENDING_KEY_MESSAGE,
} from './config';
import { errorMessage, outputError } from './output';

// The Resend SDK reads RESEND_BASE_URL at module-load time, so we patch
// fetchRequest on each instance when an OAuth profile targets a custom base URL.
function patchClientBaseUrl(client: Resend, customBaseUrl: string): void {
  (client as unknown as Record<string, unknown>).fetchRequest = async function <T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{ data: T | null; error: unknown | null; headers: Record<string, string> | null }> {
    try {
      const response = await fetch(`${customBaseUrl}${path}`, options);
      if (!response.ok) {
        try {
          const rawError = await response.text();
          return {
            data: null,
            error: JSON.parse(rawError),
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch (err) {
          if (err instanceof SyntaxError) {
            return {
              data: null,
              error: {
                name: 'application_error',
                statusCode: response.status,
                message:
                  'Internal server error. We are unable to process your request right now, please try again later.',
              },
              headers: Object.fromEntries(response.headers.entries()),
            };
          }
          const error = {
            message: response.statusText,
            statusCode: response.status,
            name: 'application_error',
          };
          if (err instanceof Error) {
            return {
              data: null,
              error: { ...error, message: err.message },
              headers: Object.fromEntries(response.headers.entries()),
            };
          }
          return { data: null, error, headers: Object.fromEntries(response.headers.entries()) };
        }
      }
      return {
        data: (await response.json()) as T,
        error: null,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch {
      return {
        data: null,
        error: {
          name: 'application_error',
          statusCode: null,
          message: 'Unable to fetch data. The request could not be resolved.',
        },
        headers: null,
      };
    }
  };
}

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
  const client = new Resend(resolved.key);
  if (resolved.oauthBaseUrl) {
    patchClientBaseUrl(client, resolved.oauthBaseUrl);
  }
  return client;
}

export async function requireClient(
  opts: GlobalOpts,
  clientOpts?: RequireClientOpts,
): Promise<Resend> {
  const profileName = opts.profile;

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

    const client = new Resend(resolved.key);
    if (resolved.oauthBaseUrl) {
      patchClientBaseUrl(client, resolved.oauthBaseUrl);
    }
    return client;
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
