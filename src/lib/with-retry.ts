type SdkResponse<T> = {
  data: T | null;
  error: { message: string; name?: string } | null;
  headers?: Record<string, string> | null;
};

const DEFAULT_RETRY_DELAYS: readonly number[] = [1, 2, 4];
const MAX_RETRIES = DEFAULT_RETRY_DELAYS.length;

const TRANSIENT_ERROR_NAMES: ReadonlySet<string> = new Set([
  'internal_server_error',
  'service_unavailable',
  'gateway_timeout',
]);

type RetryOptions = {
  retryTransient?: boolean;
  onRetry?: (attempt: number, delaySeconds: number, errorName: string) => void;
};

const isRetryable = (
  name: string | undefined,
  retryTransient: boolean,
): boolean => {
  if (name === 'rate_limit_exceeded') {
    return true;
  }
  if (retryTransient && name !== undefined && TRANSIENT_ERROR_NAMES.has(name)) {
    return true;
  }
  return false;
};

const parseRetryDelay = (
  headers?: Record<string, string> | null,
): number | undefined => {
  const value = headers?.['retry-after'];
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }

  // Retry-After is RFC 9110: usually delta-seconds, but spec allows HTTP-date.
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    const delta = (dateMs - Date.now()) / 1000;
    return delta > 0 ? delta : 0;
  }

  return undefined;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(
  call: () => Promise<SdkResponse<T>>,
  options?: RetryOptions,
  attempt = 0,
): Promise<SdkResponse<T>> => {
  const response = await call();
  const retryTransient = options?.retryTransient ?? false;
  if (
    response.error &&
    attempt < MAX_RETRIES &&
    isRetryable(response.error.name, retryTransient)
  ) {
    const delay =
      parseRetryDelay(response.headers) ?? DEFAULT_RETRY_DELAYS[attempt];
    options?.onRetry?.(attempt, delay, response.error.name ?? '');
    await sleep(delay * 1000);
    return withRetry(call, options, attempt + 1);
  }
  return response;
};

export type { RetryOptions, SdkResponse };
export { withRetry };
