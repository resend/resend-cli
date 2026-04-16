import type { Resend } from 'resend';
import type { GlobalOpts, RequireClientOpts } from './client';
import { requireClient } from './client';
import type { ApiKeyPermission } from './config';
import { outputResult } from './output';
import { confirmDelete } from './prompts';
import { deepSanitize } from './safe-terminal-text';
import { withSpinner } from './spinner';
import { isInteractive } from './tty';

type SdkCall<T> = (
  resend: Resend,
) => Promise<{ data: T | null; error: { message: string } | null }>;

export async function runGet<T>(
  config: {
    loading: string;
    sdkCall: SdkCall<T>;
    onInteractive: (data: T) => void;
    permission?: ApiKeyPermission;
  },
  globalOpts: GlobalOpts,
): Promise<void> {
  const clientOpts: RequireClientOpts | undefined = config.permission
    ? { permission: config.permission }
    : undefined;
  const resend = await requireClient(globalOpts, clientOpts);
  const data = await withSpinner(
    { loading: config.loading, retryTransient: true },
    () => config.sdkCall(resend),
    'fetch_error',
    globalOpts,
  );
  if (!globalOpts.json && isInteractive()) {
    config.onInteractive(deepSanitize(data));
  } else {
    outputResult(data, { json: globalOpts.json });
  }
}

export async function runDelete(
  id: string,
  skipConfirm: boolean,
  config: {
    confirmMessage: string;
    loading: string;
    object: string;
    successMsg: string;
    sdkCall: SdkCall<unknown>;
    permission?: ApiKeyPermission;
  },
  globalOpts: GlobalOpts,
): Promise<void> {
  const clientOpts: RequireClientOpts | undefined = config.permission
    ? { permission: config.permission }
    : undefined;
  const resend = await requireClient(globalOpts, clientOpts);
  if (!skipConfirm) {
    await confirmDelete(id, config.confirmMessage, globalOpts);
  }
  await withSpinner(
    { loading: config.loading },
    () => config.sdkCall(resend),
    'delete_error',
    globalOpts,
  );
  if (!globalOpts.json && isInteractive()) {
    console.log(config.successMsg);
  } else {
    outputResult(
      { object: config.object, id, deleted: true },
      { json: globalOpts.json },
    );
  }
}

export async function runCreate<T>(
  config: {
    loading: string;
    sdkCall: SdkCall<T>;
    onInteractive: (data: T) => void;
    permission?: ApiKeyPermission;
  },
  globalOpts: GlobalOpts,
): Promise<void> {
  const clientOpts: RequireClientOpts | undefined = config.permission
    ? { permission: config.permission }
    : undefined;
  const resend = await requireClient(globalOpts, clientOpts);
  const data = await withSpinner(
    { loading: config.loading },
    () => config.sdkCall(resend),
    'create_error',
    globalOpts,
  );
  if (!globalOpts.json && isInteractive()) {
    config.onInteractive(deepSanitize(data));
  } else {
    outputResult(data, { json: globalOpts.json });
  }
}

export async function runWrite<T>(
  config: {
    loading: string;
    sdkCall: SdkCall<T>;
    errorCode: string;
    successMsg: string;
    retryTransient?: boolean;
    permission?: ApiKeyPermission;
  },
  globalOpts: GlobalOpts,
): Promise<void> {
  const clientOpts: RequireClientOpts | undefined = config.permission
    ? { permission: config.permission }
    : undefined;
  const resend = await requireClient(globalOpts, clientOpts);
  const data = await withSpinner(
    { loading: config.loading, retryTransient: config.retryTransient },
    () => config.sdkCall(resend),
    config.errorCode,
    globalOpts,
  );
  if (!globalOpts.json && isInteractive()) {
    console.log(config.successMsg);
  } else {
    outputResult(data, { json: globalOpts.json });
  }
}

export async function runList<T>(
  config: {
    loading: string;
    sdkCall: SdkCall<T>;
    onInteractive: (result: T) => void;
    permission?: ApiKeyPermission;
  },
  globalOpts: GlobalOpts,
): Promise<void> {
  const clientOpts: RequireClientOpts | undefined = config.permission
    ? { permission: config.permission }
    : undefined;
  const resend = await requireClient(globalOpts, clientOpts);
  const result = await withSpinner(
    { loading: config.loading, retryTransient: true },
    () => config.sdkCall(resend),
    'list_error',
    globalOpts,
  );
  if (!globalOpts.json && isInteractive()) {
    config.onInteractive(deepSanitize(result));
  } else {
    outputResult(result, { json: globalOpts.json });
  }
}
