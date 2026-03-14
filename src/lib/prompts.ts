import * as p from '@clack/prompts';
import type { GlobalOpts } from './client';
import { renameProfile, validateProfileName } from './config';
import { errorMessage, outputError } from './output';
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
  if (!isInteractive() || globalOpts.json) {
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

/**
 * If a profile name is invalid (e.g. legacy names with spaces), prompt the
 * user to rename it. Returns the (possibly new) name, or null if the rename
 * could not proceed (non-interactive mode).
 */
export async function promptRenameIfInvalid(
  profileName: string,
  globalOpts: GlobalOpts,
): Promise<string | null> {
  const validationError = validateProfileName(profileName);
  if (!validationError) {
    return profileName;
  }

  if (!isInteractive() || globalOpts.json) {
    outputError(
      {
        message: `Profile "${profileName}" has an invalid name: ${validationError}`,
        code: 'invalid_profile_name',
      },
      { json: globalOpts.json },
    );
    return null;
  }

  p.log.warn(
    `Profile "${profileName}" has an invalid name: ${validationError}`,
  );

  const newName = await p.text({
    message: 'Enter a new name for this profile:',
    placeholder: profileName.replace(/[^a-zA-Z0-9_-]/g, '-'),
    validate: (v) => validateProfileName(v as string),
  });

  if (p.isCancel(newName)) {
    cancelAndExit('Rename cancelled.');
  }

  try {
    renameProfile(profileName, newName);
  } catch (err) {
    outputError(
      {
        message: errorMessage(err, 'Failed to rename profile'),
        code: 'rename_failed',
      },
      { json: globalOpts.json },
    );
    return null;
  }

  p.log.success(`Profile renamed to '${newName}'.`);
  return newName;
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

  if (!isInteractive() || globalOpts.json) {
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

  if (!isInteractive() || globalOpts.json) {
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

  if (!isInteractive() || globalOpts.json) {
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
