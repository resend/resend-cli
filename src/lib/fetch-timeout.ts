export const REQUEST_TIMEOUT_MS = 30_000;

const originalFetch = globalThis.fetch;

globalThis.fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  return originalFetch(input, { ...init, signal });
};
