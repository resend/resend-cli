import pc from 'picocolors';

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export interface OutputOptions {
  json?: boolean;
  exitCode?: number;
}

export interface ErrorOutput {
  message: string;
  code?: string;
  statusCode?: number | null;
  headers?: Record<string, string> | null;
  body?: string | null;
}

function shouldOutputJson(json?: boolean): boolean {
  if (json) {
    return true;
  }
  if (!process.stdout.isTTY) {
    return true;
  }
  return false;
}

export function outputResult(data: unknown, opts: OutputOptions = {}): void {
  if (shouldOutputJson(opts.json)) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
  if (opts.exitCode !== undefined) {
    process.exit(opts.exitCode);
  }
}

// Headers worth surfacing to a human debugging a failed request. Anything
// outside this set, except custom `x-*` headers, is dropped so we don't
// echo cookies, dates, server banners, etc.
const ALLOWED_DIAGNOSTIC_HEADERS: ReadonlySet<string> = new Set([
  'content-type',
  'retry-after',
]);

function filterDiagnosticHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase();
    if (ALLOWED_DIAGNOSTIC_HEADERS.has(k) || k.startsWith('x-')) {
      out[k] = value;
    }
  }
  return out;
}

export function outputError(
  error: ErrorOutput,
  opts: OutputOptions = {},
): never {
  const exitCode = opts.exitCode ?? 1;
  const filteredHeaders =
    error.headers && Object.keys(error.headers).length > 0
      ? filterDiagnosticHeaders(error.headers)
      : undefined;
  const hasFilteredHeaders =
    filteredHeaders !== undefined && Object.keys(filteredHeaders).length > 0;

  if (shouldOutputJson(opts.json)) {
    const envelope: Record<string, unknown> = {
      message: error.message,
      code: error.code ?? 'unknown',
    };
    if (typeof error.statusCode === 'number') {
      envelope.statusCode = error.statusCode;
    }
    if (hasFilteredHeaders) {
      envelope.headers = filteredHeaders;
    }
    if (typeof error.body === 'string' && error.body.length > 0) {
      envelope.body = error.body;
    }
    console.error(JSON.stringify({ error: envelope }, null, 2));
  } else {
    console.error(`${pc.red('Error:')} ${error.message}`);
    const parts: string[] = [];
    if (typeof error.statusCode === 'number') {
      parts.push(`HTTP ${error.statusCode}`);
    }
    if (hasFilteredHeaders) {
      for (const [k, v] of Object.entries(filteredHeaders)) {
        parts.push(`${k}: ${v}`);
      }
    }
    if (parts.length > 0) {
      console.error(pc.dim(`[${parts.join('; ')}]`));
    }
  }

  process.exit(exitCode);
}
