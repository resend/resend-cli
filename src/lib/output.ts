import pc from 'picocolors';

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export interface OutputOptions {
  json?: boolean;
  exitCode?: number;
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

export function outputError(
  error: { message: string; code?: string },
  opts: OutputOptions = {},
): never {
  const exitCode = opts.exitCode ?? 1;

  if (shouldOutputJson(opts.json)) {
    console.error(
      JSON.stringify(
        { error: { message: error.message, code: error.code ?? 'unknown' } },
        null,
        2,
      ),
    );
  } else {
    console.error(`${pc.red('Error:')} ${error.message}`);
  }

  process.exit(exitCode);
}
