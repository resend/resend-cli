import spinners from 'unicode-animations';
import type { GlobalOpts } from './client';
import { errorMessage, outputError } from './output';
import { isInteractive, isUnicodeSupported } from './tty';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const TICK = isUnicodeSupported ? String.fromCodePoint(0x2714) : 'v'; // ✔
const WARN = isUnicodeSupported ? String.fromCodePoint(0x26a0) : '!'; // ⚠
const CROSS = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

type SdkResponse<T> = { data: T | null; error: { message: string } | null };

/**
 * Wraps an SDK call with a spinner, unified error handling, and automatic stop/fail.
 * Eliminates the repeated try/catch + spinner boilerplate across all command files.
 */
export async function withSpinner<T>(
  messages: { loading: string; success: string; fail: string },
  call: () => Promise<SdkResponse<T>>,
  errorCode: string,
  globalOpts: GlobalOpts,
): Promise<T> {
  const spinner = createSpinner(messages.loading);
  try {
    const { data, error } = await call();
    if (error) {
      spinner.fail(messages.fail);
      outputError(
        { message: error.message, code: errorCode },
        { json: globalOpts.json },
      );
    }
    if (data === null) {
      spinner.fail(messages.fail);
      outputError(
        { message: 'Unexpected empty response', code: errorCode },
        { json: globalOpts.json },
      );
    }
    spinner.stop(messages.success);
    return data;
  } catch (err) {
    spinner.fail(messages.fail);
    return outputError(
      { message: errorMessage(err, 'Unknown error'), code: errorCode },
      { json: globalOpts.json },
    );
  }
}

export type SpinnerName = keyof typeof spinners;

export function createSpinner(message: string, name: SpinnerName = 'braille') {
  if (!isInteractive()) {
    return {
      update(_msg: string) {},
      stop(_msg: string) {},
      warn(_msg: string) {},
      fail(_msg: string) {},
    };
  }

  const { frames, interval } = spinners[name];
  let i = 0;
  let text = message;

  const timer = setInterval(() => {
    process.stderr.write(`\r\x1B[2K  ${frames[i++ % frames.length]} ${text}`);
  }, interval);

  return {
    update(msg: string) {
      text = msg;
    },
    stop(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${TICK} ${msg}\n`);
    },
    warn(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${WARN} ${msg}\n`);
    },
    fail(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ${CROSS} ${msg}\n`);
    },
  };
}
