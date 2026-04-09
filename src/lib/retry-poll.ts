type SdkResponse<T> = {
  readonly data: T | null;
  readonly error: { readonly message: string; readonly name?: string } | null;
  readonly headers?: Record<string, string> | null;
};

type RetryPollSuccess<T> = { readonly success: true; readonly data: T };
type RetryPollFailure = { readonly success: false; readonly message: string };
export type RetryPollResult<T> = RetryPollSuccess<T> | RetryPollFailure;

export type RetryPollOpts = {
  readonly delayMs?: (ms: number) => Promise<void>;
};

const DEFAULT_RETRY_DELAYS = [1, 2, 4];
const MAX_RETRIES = DEFAULT_RETRY_DELAYS.length;

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryDelay = (
  headers?: Record<string, string> | null,
): number | undefined => {
  const value = headers?.['retry-after'];
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
};

const pollAttempt = async <T>(
  call: () => Promise<SdkResponse<T>>,
  n: number,
  delay: (ms: number) => Promise<void>,
): Promise<RetryPollResult<T>> => {
  try {
    const { data, error, headers } = await call();
    if (error) {
      if (n < MAX_RETRIES && error.name === 'rate_limit_exceeded') {
        const wait = parseRetryDelay(headers) ?? DEFAULT_RETRY_DELAYS[n];
        await delay(wait * 1000);
        return pollAttempt(call, n + 1, delay);
      }
      return { success: false, message: error.message };
    }
    if (data === null) {
      return { success: false, message: 'Unexpected empty response' };
    }
    return { success: true, data };
  } catch (err) {
    if (n < MAX_RETRIES) {
      const wait = DEFAULT_RETRY_DELAYS[n];
      await delay(wait * 1000);
      return pollAttempt(call, n + 1, delay);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

export const retryPoll = <T>(
  call: () => Promise<SdkResponse<T>>,
  opts: RetryPollOpts = {},
): Promise<RetryPollResult<T>> =>
  pollAttempt(call, 0, opts.delayMs ?? defaultDelay);
