type RetryableResponse<T> = {
  data: T | null;
  error: { message: string; name?: string } | null;
  headers?: Record<string, string> | null;
};

const DEFAULT_RETRY_DELAYS: readonly number[] = [1, 2, 4];
const MAX_RETRIES = DEFAULT_RETRY_DELAYS.length;

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
  call: () => Promise<RetryableResponse<T>>,
  attempt = 0,
): Promise<RetryableResponse<T>> => {
  const response = await call();
  if (
    response.error &&
    attempt < MAX_RETRIES &&
    response.error.name === 'rate_limit_exceeded'
  ) {
    const delay =
      parseRetryDelay(response.headers) ?? DEFAULT_RETRY_DELAYS[attempt];
    await sleep(delay * 1000);
    return withRetry(call, attempt + 1);
  }
  return response;
};

export type { RetryableResponse };
export { withRetry };
