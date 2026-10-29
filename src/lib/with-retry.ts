type SdkResponse<T> = {
  data: T | null;
  error: {
    message: string;
    name?: string;
    statusCode?: number | null;
  } | null;
  headers?: Record<string, string> | null;
};

const DEFAULT_RETRY_DELAYS: readonly number[] = [1, 2, 4];
const MAX_RETRIES = DEFAULT_RETRY_DELAYS.length;

const TRANSIENT_ERROR_NAMES: ReadonlySet<string> = new Set([
  'internal_server_error',
  'service_unavailable',
  'gateway_timeout',
]);

// The name alone misses most transient failures: the API's own 500 is named
// application_error, and when a gateway or load balancer answers with a non-JSON
// page the SDK reports application_error with the real status. The status is
// what says "try again".
const TRANSIENT_STATUS_CODES: ReadonlySet<number> = new Set([
  500, 502, 503, 504,
]);

type RetryOptions = {
  retryTransient?: boolean;
  onRetry?: (attempt: number, delaySeconds: number, errorName: string) => void;
};

const isRetryable = (
  error: NonNullable<SdkResponse<unknown>['error']>,
  retryTransient: boolean,
): boolean => {
  if (error.name === 'rate_limit_exceeded') {
    return true;
  }
  if (!retryTransient) {
    return false;
  }
  return (
    (error.name !== undefined && TRANSIENT_ERROR_NAMES.has(error.name)) ||
    (typeof error.statusCode === 'number' &&
      TRANSIENT_STATUS_CODES.has(error.statusCode))
  );
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
    isRetryable(response.error, retryTransient)
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
