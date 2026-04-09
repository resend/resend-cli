type ForwardResult = { readonly status: number } | { readonly error: string };

export const resolveUpstream = (
  result: ForwardResult | undefined,
): { readonly status: number; readonly body: string } => {
  if (!result) {
    return { status: 200, body: 'OK' };
  }
  if ('error' in result) {
    return { status: 502, body: 'Forward target unreachable' };
  }
  return result.status >= 200 && result.status < 300
    ? { status: 200, body: 'OK' }
    : { status: result.status, body: 'Forward target failed' };
};
