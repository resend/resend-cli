import * as p from '@clack/prompts';
import type { GlobalOpts } from './client';
import { outputError } from './output';
import { isInteractive } from './tty';

export interface FieldSpec {
  flag: string;
  message: string;
  placeholder?: string;
  required?: boolean;
  validate?: (value: string | undefined) => string | undefined;
}

export function cancelAndExit(message: string): never {
  p.cancel(message);
  process.exit(0);
}

/**
 * Guard a delete action: error in non-interactive mode (no --yes), or show a
 * confirmation prompt in interactive mode. Exits the process on cancel/rejection.
 */
export async function confirmDelete(
  _id: string,
  confirmMessage: string,
  globalOpts: GlobalOpts,
): Promise<void> {
  if (!isInteractive()) {
    outputError(
      {
        message: 'Use --yes to confirm deletion in non-interactive mode.',
        code: 'confirmation_required',
      },
      { json: globalOpts.json },
    );
  }

  const confirmed = await p.confirm({ message: confirmMessage });
  if (p.isCancel(confirmed) || !confirmed) {
    cancelAndExit('Deletion cancelled.');
  }
}

export async function requireText(
  value: string | undefined,
  prompt: {
    message: string;
    placeholder?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
  },
  error: { message: string; code: string },
  globalOpts: GlobalOpts,
): Promise<string> {
  if (value) {
    return value;
  }

  if (!isInteractive()) {
    outputError(error, { json: globalOpts.json });
  }

  const result = await p.text({
    message: prompt.message,
    placeholder: prompt.placeholder,
    validate:
      prompt.validate ??
      ((v) =>
        !v || v.length === 0 ? `${prompt.message} is required` : undefined),
  });
  if (p.isCancel(result)) {
    cancelAndExit('Cancelled.');
  }
  return result;
}

export async function requireSelect<V extends string>(
  value: V | undefined,
  prompt: {
    message: string;
    options: Parameters<typeof p.select<V>>[0]['options'];
  },
  error: { message: string; code: string },
  globalOpts: GlobalOpts,
): Promise<V> {
  if (value) {
    return value;
  }

  if (!isInteractive()) {
    outputError(error, { json: globalOpts.json });
  }

  const result = await p.select<V>({
    message: prompt.message,
    options: prompt.options,
  });
  if (p.isCancel(result)) {
    cancelAndExit('Cancelled.');
  }
  return result;
}

export async function promptForMissing<
  T extends Record<string, string | undefined>,
>(
  current: T,
  fields: FieldSpec[],
  globalOpts: GlobalOpts,
): Promise<{ [K in keyof T]: string }> {
  const missing = fields.filter(
    (f) => f.required !== false && !current[f.flag],
  );

  if (missing.length === 0) {
    return current as { [K in keyof T]: string };
  }

  if (!isInteractive()) {
    const flags = missing.map((f) => `--${f.flag}`).join(', ');
    outputError(
      { message: `Missing required flags: ${flags}`, code: 'missing_flags' },
      { json: globalOpts.json },
    );
  }

  const result = await p.group(
    Object.fromEntries(
      missing.map((field) => [
        field.flag,
        () =>
          p.text({
            message: field.message,
            placeholder: field.placeholder,
            validate:
              field.validate ??
              ((v) =>
                !v || v.length === 0
                  ? `${field.message} is required`
                  : undefined),
          }),
      ]),
    ),
    {
      onCancel: () => cancelAndExit('Operation cancelled.'),
    },
  );

  return { ...current, ...result } as { [K in keyof T]: string };
}
