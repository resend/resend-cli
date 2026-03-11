import { Command } from '@commander-js/extra-typings';
import { Resend } from 'resend';
import type { GlobalOpts } from '../lib/client';
import { maskKey, resolveApiKey } from '../lib/config';
import { buildHelpText } from '../lib/help-text';
import { errorMessage, outputResult } from '../lib/output';
import { createSpinner } from '../lib/spinner';
import { isInteractive } from '../lib/tty';
import { PACKAGE_NAME, VERSION } from '../lib/version';

type CheckStatus = 'pass' | 'warn' | 'fail';

type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
};

const statusIcons: Record<CheckStatus, string> = {
  pass: '\x1B[32m✔\x1B[0m',
  warn: '\x1B[33m!\x1B[0m',
  fail: '\x1B[31m✗\x1B[0m',
};

async function checkCliVersion(): Promise<CheckResult> {
  try {
    const encodedName = encodeURIComponent(PACKAGE_NAME);
    const res = await fetch(
      `https://registry.npmjs.org/${encodedName}/latest`,
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      return {
        name: 'CLI Version',
        status: 'warn',
        message: `v${VERSION} (could not check for updates)`,
      };
    }
    const data = (await res.json()) as { version?: string };
    const latest = data.version ?? 'unknown';
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

function checkApiKeyPresence(flagValue?: string): CheckResult {
  const resolved = resolveApiKey(flagValue);
  if (!resolved) {
    return {
      name: 'API Key',
      status: 'fail',
      message: 'No API key found',
      detail: 'Run: resend login',
    };
  }
  const teamInfo = resolved.team ? `, team: ${resolved.team}` : '';
  return {
    name: 'API Key',
    status: 'pass',
    message: `${maskKey(resolved.key)} (source: ${resolved.source}${teamInfo})`,
  };
}

async function checkApiValidationAndDomains(): Promise<CheckResult> {
  const resolved = resolveApiKey();
  if (!resolved) {
    return {
      name: 'API Validation',
      status: 'fail',
      message: 'Skipped — no API key',
    };
  }

  try {
    const resend = new Resend(resolved.key);
    const { data, error } = await resend.domains.list();

    if (error) {
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
  CLI Version    Is the installed version up to date?
  API Key        Is a key present (--api-key, RESEND_API_KEY, or credentials file)?
  API Validation Is the key valid and accepted by the Resend API?`,
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
    let spinner = interactive
      ? createSpinner('Checking CLI version...', 'orbit')
      : null;
    const versionCheck = await checkCliVersion();
    checks.push(versionCheck);
    if (versionCheck.status === 'warn') {
      spinner?.warn(versionCheck.message);
    } else {
      spinner?.stop(versionCheck.message);
    }

    // Check 2: API Key
    spinner = interactive ? createSpinner('Checking API key...', 'scan') : null;
    const keyCheck = checkApiKeyPresence(globalOpts.apiKey);
    checks.push(keyCheck);
    if (keyCheck.status === 'fail') {
      spinner?.fail(keyCheck.message);
    } else {
      spinner?.stop(keyCheck.message);
    }

    // Check 3: API Validation + Domains
    spinner = interactive
      ? createSpinner('Validating API key & domains...', 'scan')
      : null;
    const domainCheck = await checkApiValidationAndDomains();
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
