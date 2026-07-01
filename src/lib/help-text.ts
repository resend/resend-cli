import pc from 'picocolors';

export interface HelpTextOptions {
  context?: string; // All text before Global options (includes Non-interactive line if needed)
  output?: string; // Content after "Output (--json or piped):" header (raw string, may be multi-line)
  errorCodes?: string[]; // ['auth_error', 'list_error'] — joined with ' | '
  examples: string[]; // Command strings without '$ ' prefix (added automatically)
  setup?: boolean; // true = --json only (no --api-key); default false = full API variant
}

const GLOBAL_OPTS_FULL = `${pc.gray('Global options:')}
  --api-key <key>     API key (or set RESEND_API_KEY env var)
  -p, --profile <name>  Profile to use (overrides RESEND_PROFILE)
  --json              Force JSON output (also auto-enabled when stdout is piped)
  -q, --quiet         Suppress spinners and status output (implies --json)`;

const GLOBAL_OPTS_SETUP = `${pc.gray('Global options:')}
  -p, --profile <name>  Profile to use
  --json            Force JSON output
  -q, --quiet       Suppress spinners and status output (implies --json)`;

const ERROR_ENVELOPE = `  {"error":{"message":"<message>","code":"<code>"}}`;

export function buildHelpText(opts: HelpTextOptions): string {
  const parts: string[] = [];
  if (opts.context != null) {
    parts.push(opts.context);
  }
  parts.push(opts.setup ? GLOBAL_OPTS_SETUP : GLOBAL_OPTS_FULL);
  if (opts.output != null) {
    parts.push(`${pc.gray('Output (--json or piped):')}\n${opts.output}`);
  }
  if (opts.errorCodes != null) {
    parts.push(
      `${pc.gray('Errors (exit code 1, JSON on stderr when using --json or non-TTY):')}\n${ERROR_ENVELOPE}\n  Codes: ${opts.errorCodes.join(' | ')}`,
    );
  }
  parts.push(
    `${pc.gray('Examples:')}\n${opts.examples.map((e) => `  ${pc.blue(`$ ${e}`)}`).join('\n')}`,
  );
  return `\n${parts.join('\n\n')}`;
}
