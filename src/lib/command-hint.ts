import pc from 'picocolors';

const MAX_VALUE_LENGTH = 120;

const SAFE_CHARS = /^[a-zA-Z0-9@._:/=+-]+$/;

function shellQuote(s: string): string {
  if (s.length === 0) {
    return "''";
  }
  if (SAFE_CHARS.test(s)) {
    return s;
  }
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export interface CommandHintFlag {
  flag: string;
  value: string | string[] | boolean;
}

export function buildEquivalentCommand(
  base: string,
  flags: CommandHintFlag[],
): string {
  const parts = [base];
  for (const { flag, value } of flags) {
    if (value === true) {
      parts.push(`--${flag}`);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`--${flag}`, shellQuote(v));
      }
    } else if (typeof value === 'string' && value !== '') {
      const quoted =
        value.length > MAX_VALUE_LENGTH
          ? shellQuote(`${value.slice(0, MAX_VALUE_LENGTH)}...`)
          : shellQuote(value);
      parts.push(`--${flag}`, quoted);
    }
  }
  return parts.join(' ');
}

export function printCommandHint(command: string): void {
  console.log(`\n${pc.dim('Equivalent command:')}`);
  console.log(`  ${pc.dim('$')} ${command}`);
}
