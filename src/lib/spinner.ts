import pc from 'picocolors';
import type { GlobalOpts } from './client';
import { errorMessage, outputError } from './output';
import { isInteractive, isUnicodeSupported } from './tty';
import { type SdkResponse, withRetry } from './with-retry';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const TICK = isUnicodeSupported ? String.fromCodePoint(0x2714) : 'v'; // ✔
const WARN = isUnicodeSupported ? String.fromCodePoint(0x26a0) : '!'; // ⚠
const CROSS = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

// Braille spinner: cycle through U+2800-block dot patterns.
const SPINNER_FRAMES = [
  '\u2839',
  '\u2838',
  '\u2834',
  '\u2826',
  '\u2807',
  '\u280F',
  '\u2819',
  '\u2839',
];
const SPINNER_INTERVAL = 80;

type WithSpinnerOptions = {
  retryTransient?: boolean;
};

/**
 * Wraps an SDK call with a loading spinner and unified error handling.
 *
 * The spinner is purely a loading indicator — it clears itself when the call
 * completes. Callers are responsible for printing success output.
 *
 * Always retries rate_limit_exceeded (HTTP 429) up to 3 times via withRetry,
 * with retry-after when available or 1s/2s/4s backoff. When `retryTransient`
 * is set, also retries transient 5xx errors (internal_server_error,
 * service_unavailable, gateway_timeout) with the same schedule. Callers
 * should opt into transient retry only for idempotent operations.
 */
export async function withSpinner<T>(
  loading: string,
  call: () => Promise<SdkResponse<T>>,
  errorCode: string,
  globalOpts: GlobalOpts,
  options: WithSpinnerOptions = {},
): Promise<T> {
  const spinner = createSpinner(loading, globalOpts.quiet);
  try {
    const { data, error } = await withRetry(call, {
      retryTransient: options.retryTransient,
      onRetry: (_attempt, delay, errorName) => {
        spinner.update(
          errorName === 'rate_limit_exceeded'
            ? `Rate limited, retrying in ${delay}s...`
            : `Server error, retrying in ${delay}s...`,
        );
      },
    });
    if (error) {
      spinner.stop();
      outputError(
        { message: error.message, code: errorCode },
        { json: globalOpts.json },
      );
    }
    if (data === null) {
      spinner.stop();
      outputError(
        { message: 'Unexpected empty response', code: errorCode },
        { json: globalOpts.json },
      );
    }
    spinner.stop();
    return data;
  } catch (err) {
    spinner.stop();
    return outputError(
      { message: errorMessage(err, 'Unknown error'), code: errorCode },
      { json: globalOpts.json },
    );
  }
}

export function createSpinner(message: string, quiet?: boolean) {
  if (quiet || !isInteractive()) {
    return {
      update(_msg: string) {},
      stop(_msg?: string) {},
      clear() {},
      warn(_msg: string) {},
      fail(_msg: string) {},
    };
  }

  const frames = isUnicodeSupported ? SPINNER_FRAMES : ['-', '\\', '|', '/'];
  const interval = SPINNER_INTERVAL;
  let i = 0;
  let text = message;

  const timer = setInterval(() => {
    process.stderr.write(`\r\x1B[2K  ${frames[i++ % frames.length]} ${text}`);
  }, interval);

  return {
    update(msg: string) {
      text = msg;
    },
    stop(msg?: string) {
      clearInterval(timer);
      if (msg) {
        process.stderr.write(`\r\x1B[2K  ${pc.green(TICK)} ${msg}\n`);
      } else {
        process.stderr.write('\r\x1B[2K');
      }
    },
    clear() {
      clearInterval(timer);
      process.stderr.write('\r\x1B[2K');
    },
    warn(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${pc.yellow(WARN)} ${msg}\n`);
    },
    fail(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${pc.red(CROSS)} ${msg}\n`);
    },
  };
}
