import { Command } from '@commander-js/extra-typings';
import { Resend } from 'resend';
import type { GlobalOpts } from '../lib/client';
import {
  maskKey,
  readCredentials,
  resolveApiKeyAsync,
  SENDING_KEY_MESSAGE,
} from '../lib/config';
import { getCredentialBackend } from '../lib/credential-store';
import { buildHelpText } from '../lib/help-text';
import { errorMessage, outputResult } from '../lib/output';
import { createSpinner } from '../lib/spinner';
import { isInteractive } from '../lib/tty';
import { GITHUB_RELEASES_URL } from '../lib/update-check';
import { VERSION } from '../lib/version';
import { TIMEOUT_ERROR_NAME, withTimeout } from '../utils/with-timeout';

const API_TIMEOUT_MS = 5000;

type CheckStatus = 'pass' | 'warn' | 'fail';

type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
};

async function checkCliVersion(): Promise<CheckResult> {
  try {
    const res = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return {
        name: 'CLI Version',
        status: 'warn',
        message: `v${VERSION} (could not check for updates)`,
      };
    }
    const data = (await res.json()) as {
      tag_name?: string;
      prerelease?: boolean;
      draft?: boolean;
    };
    if (data.prerelease || data.draft) {
      return {
        name: 'CLI Version',
        status: 'warn',
        message: `v${VERSION} (could not check for updates)`,
      };
    }
    const latest = data.tag_name?.replace(/^v/, '') ?? 'unknown';
    if (latest === VERSION) {
      return {
        name: 'CLI Version',
        status: 'pass',
        message: `v${VERSION} (latest)`,
      };
    }
    return {
      name: 'CLI Version',
      status: 'warn',
      message: `v${VERSION} (latest: v${latest})`,
      detail: 'Update available',
    };
  } catch {
    return {
      name: 'CLI Version',
      status: 'warn',
      message: `v${VERSION} (could not check for updates)`,
    };
  }
}

async function checkApiKeyPresence(flagValue?: string): Promise<CheckResult> {
  const resolved = await resolveApiKeyAsync(flagValue);
  if (!resolved) {
    return {
      name: 'API Key',
      status: 'fail',
      message: 'No API key found',
      detail: 'Run: resend login',
    };
  }
  const profileInfo = resolved.profile ? `, profile: ${resolved.profile}` : '';
  return {
    name: 'API Key',
    status: 'pass',
    message: `${maskKey(resolved.key)} (source: ${resolved.source}${profileInfo})`,
  };
}

async function checkApiValidationAndDomains(
  flagValue?: string,
): Promise<CheckResult> {
  const resolved = await resolveApiKeyAsync(flagValue);
  if (!resolved) {
    return {
      name: 'API Validation',
      status: 'fail',
      message: 'Skipped — no API key',
    };
  }

  try {
    const resend = new Resend(resolved.key);
    const { data, error } = await withTimeout(
      resend.domains.list(),
      API_TIMEOUT_MS,
    );

    if (error) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'restricted_api_key') {
        return {
          name: 'API Validation',
          status: 'warn',
          message: `Sending-only API key`,
          detail: SENDING_KEY_MESSAGE,
        };
      }
      if (err.name === 'application_error') {
        return {
          name: 'API Validation',
          status: 'warn',
          message: 'Network error. Check your connection and try again',
        };
      }
      return {
        name: 'API Validation',
        status: 'fail',
        message: `API key invalid: ${error.message}`,
      };
    }

    const domains = data?.data ?? [];
    const verified = domains.filter((d) => d.status === 'verified');
    const pending = domains.filter((d) => d.status !== 'verified');

    if (domains.length === 0) {
      return {
        name: 'Domains',
        status: 'warn',
        message: 'No domains configured',
        detail: 'Add a domain at https://resend.com/domains',
      };
    }

    if (verified.length === 0) {
      return {
        name: 'Domains',
        status: 'warn',
        message: `${pending.length} domain(s) pending verification`,
        detail: domains.map((d) => `${d.name} (${d.status})`).join(', '),
      };
    }

    return {
      name: 'Domains',
      status: 'pass',
      message: `${verified.length} verified, ${pending.length} pending`,
      detail: domains.map((d) => `${d.name} (${d.status})`).join(', '),
    };
  } catch (err) {
    if (err instanceof Error && err.name === TIMEOUT_ERROR_NAME) {
      return {
        name: 'API Validation',
        status: 'warn',
        message: 'Request timed out',
      };
    }
    return {
      name: 'API Validation',
      status: 'fail',
      message: errorMessage(err, 'Failed to validate API key'),
    };
  }
}

export const doctorCommand = new Command('doctor')
  .description('Check CLI version, API key, and domain status')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Checks performed:
  CLI Version          Is the installed version up to date?
  API Key              Is a key present (--api-key, RESEND_API_KEY, or credentials file)?
  Credential Storage   Which backend is storing credentials (secure storage vs plaintext file)?
  API Validation       Is the key valid and accepted by the Resend API?`,
      output: `  {\n    "ok": true,\n    "checks": [\n      {"name":"CLI Version","status":"pass","message":"v0.1.0 (latest)"},\n      {"name":"API Key","status":"pass","message":"re_...abcd (source: env)"},\n      {"name":"Domains","status":"pass","message":"1 verified, 0 pending"}\n    ]\n  }\n  status values: "pass" | "warn" | "fail"\n  Exit code 1 if any check has status "fail"`,
      examples: ['resend doctor', 'resend doctor --json'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const checks: CheckResult[] = [];
    const interactive = isInteractive() && !globalOpts.json;

    if (interactive) {
      console.log('\n  Resend Doctor\n');
    }

    // Check 1: CLI Version
    let spinner = interactive ? createSpinner('Checking CLI version...') : null;
    const versionCheck = await checkCliVersion();
    checks.push(versionCheck);
    if (versionCheck.status === 'warn') {
      spinner?.warn(versionCheck.message);
    } else {
      spinner?.stop(versionCheck.message);
    }

    // Check 2: API Key
    spinner = interactive ? createSpinner('Checking API key...') : null;
    const keyCheck = await checkApiKeyPresence(globalOpts.apiKey);
    checks.push(keyCheck);
    if (keyCheck.status === 'fail') {
      spinner?.fail(keyCheck.message);
    } else {
      spinner?.stop(keyCheck.message);
    }

    // Check 3: Credential Storage
    spinner = interactive
      ? createSpinner('Checking credential storage...')
      : null;
    const backend = await getCredentialBackend();
    const creds = readCredentials();
    const usingSecure = backend.isSecure;
    const storageCheck: CheckResult = {
      name: 'Credential Storage',
      status: usingSecure ? 'pass' : 'warn',
      message: usingSecure ? backend.name : 'plaintext file',
      ...(!usingSecure &&
      process.env.RESEND_CREDENTIAL_STORE !== 'file' &&
      (creds?.storage === 'secure_storage' ||
        process.env.RESEND_CREDENTIAL_STORE === 'secure_storage')
        ? {
            detail:
              'Secure backend unavailable despite secure storage preference — falling back to plaintext',
          }
        : {}),
    };
    checks.push(storageCheck);
    if (storageCheck.status === 'warn') {
      spinner?.warn(storageCheck.message);
    } else {
      spinner?.stop(storageCheck.message);
    }

    // Check 4: API Validation + Domains
    spinner = interactive
      ? createSpinner('Validating API key & domains...')
      : null;
    const domainCheck = await checkApiValidationAndDomains(globalOpts.apiKey);
    checks.push(domainCheck);
    if (domainCheck.status === 'fail') {
      spinner?.fail(domainCheck.message);
    } else if (domainCheck.status === 'warn') {
      spinner?.warn(domainCheck.message);
    } else {
      spinner?.stop(domainCheck.message);
    }

    const hasFails = checks.some((c) => c.status === 'fail');

    if (!globalOpts.json && isInteractive()) {
      console.log('');
    } else {
      outputResult({ ok: !hasFails, checks }, { json: globalOpts.json });
    }

    if (hasFails) {
      process.exit(1);
    }
  });
