export const TIMEOUT_ERROR_NAME = 'TimeoutError';

export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let id: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => {
      const error = new Error(`Operation timed out after ${ms}ms`);
      error.name = TIMEOUT_ERROR_NAME;
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(id);
  });
};
