import * as p from '@clack/prompts';
import type { Resend } from 'resend';
import { cancelAndExit } from './prompts';

export async function fetchVerifiedDomains(resend: Resend): Promise<string[]> {
  try {
    const { data, error } = await resend.domains.list();
    if (error || !data) {
      return [];
    }
    return data.data
      .filter(
        (d) => d.status === 'verified' && d.capabilities.sending === 'enabled',
      )
      .map((d) => d.name);
  } catch {
    return [];
  }
}

const FROM_PREFIXES = ['noreply', 'hello'];

export async function promptForFromAddress(domains: string[]): Promise<string> {
  let domain: string;
  if (domains.length === 1) {
    domain = domains[0];
  } else {
    const result = await p.select({
      message: 'Select a verified domain',
      options: domains.map((d) => ({ value: d, label: d })),
    });
    if (p.isCancel(result)) {
      cancelAndExit('Send cancelled.');
    }
    domain = result;
  }

  const options: Array<{ value: string | null; label: string }> =
    FROM_PREFIXES.map((prefix) => ({
      value: `${prefix}@${domain}`,
      label: `${prefix}@${domain}`,
    }));
  options.push({ value: null, label: 'Custom address...' });

  const result = await p.select({
    message: `From address (@${domain})`,
    options,
  });
  if (p.isCancel(result)) {
    cancelAndExit('Send cancelled.');
  }

  if (result === null) {
    const custom = await p.text({
      message: 'From address',
      placeholder: `you@${domain}`,
      validate: (v) =>
        !v || !v.includes('@') ? 'Enter a valid email address' : undefined,
    });
    if (p.isCancel(custom)) {
      cancelAndExit('Send cancelled.');
    }
    return custom;
  }

  return result;
}
