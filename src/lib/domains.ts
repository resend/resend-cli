import * as p from '@clack/prompts';
import type { Resend } from 'resend';
import { cancelAndExit } from './prompts';

const isVerifiedSendingDomain = (d: {
  status: string;
  capabilities: { sending: string };
}) => d.status === 'verified' && d.capabilities.sending === 'enabled';

const collectVerifiedDomains = async (
  resend: Resend,
  accumulated: readonly string[],
  after?: string,
): Promise<string[] | null> => {
  const { data, error } = await resend.domains.list(
    after ? { after } : undefined,
  );

  if (error || !data) {
    return null;
  }

  const names = data.data.filter(isVerifiedSendingDomain).map((d) => d.name);
  const all = [...accumulated, ...names];

  if (!(data.has_more ?? false) || data.data.length === 0) {
    return all;
  }

  return collectVerifiedDomains(
    resend,
    all,
    data.data[data.data.length - 1].id,
  );
};

export const fetchVerifiedDomains = async (
  resend: Resend,
): Promise<string[] | null> => {
  try {
    return await collectVerifiedDomains(resend, []);
  } catch {
    return null;
  }
};

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
      placeholder: `e.g. you@${domain}`,
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
