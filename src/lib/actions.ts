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

/**
 * Shared pattern for all get commands:
 *   requireClient → withSpinner(fetch_error) → if/else output
 */
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
    config.loading,
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

/**
 * Shared pattern for all delete commands:
 *   requireClient → confirmDelete (if needed) → withSpinner → if/else output
 */
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
    config.loading,
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

/**
 * Shared pattern for create commands:
 *   requireClient → withSpinner('create_error') → if/else output
 */
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
    config.loading,
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

/**
 * Shared pattern for write commands (update/verify/remove-segment) where
 * interactive output is a single status message:
 *   requireClient → withSpinner(errorCode) → if/else output
 */
export async function runWrite<T>(
  config: {
    loading: string;
    sdkCall: SdkCall<T>;
    errorCode: string;
    successMsg: string;
    permission?: ApiKeyPermission;
  },
  globalOpts: GlobalOpts,
): Promise<void> {
  const clientOpts: RequireClientOpts | undefined = config.permission
    ? { permission: config.permission }
    : undefined;
  const resend = await requireClient(globalOpts, clientOpts);
  const data = await withSpinner(
    config.loading,
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

/**
 * Shared pattern for all list commands:
 *   requireClient → withSpinner → if/else output
 *
 * Callers pass pagination opts (if any) via the sdkCall closure.
 * The onInteractive callback handles table rendering and pagination hints.
 */
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
    config.loading,
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
