const TRANSIENT_ERROR_NAMES: ReadonlySet<string> = new Set([
  'internal_server_error',
  'service_unavailable',
  'gateway_timeout',
]);

export const isTransientError = (name?: string): boolean =>
  name != null && TRANSIENT_ERROR_NAMES.has(name);
