import * as p from '@clack/prompts';
import type { Resend } from 'resend';
import { getCancelExitCode } from './cli-exit';
import type { GlobalOpts } from './client';
import { requireClient } from './client';
import { renameProfileAsync, validateProfileName } from './config';
import { errorMessage, outputError } from './output';
import { createSpinner } from './spinner';
import { isInteractive } from './tty';

export interface FieldSpec {
  flag: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  validate?: (value: string | undefined) => string | undefined;
}

export function cancelAndExit(message: string): never {
  p.cancel(message);
  process.exit(getCancelExitCode());
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
    placeholder: profileName.replace(/[^a-zA-Z0-9._-]/g, '-'),
    validate: (v) => validateProfileName(v as string),
  });

  if (p.isCancel(newName)) {
    cancelAndExit('Rename cancelled.');
  }

  try {
    await renameProfileAsync(profileName, newName);
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
    defaultValue?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
  },
  error: { message: string; code: string },
  globalOpts: GlobalOpts,
): Promise<string> {
  if (value !== undefined) {
    return value;
  }

  if (!isInteractive() || globalOpts.json) {
    outputError(error, { json: globalOpts.json });
  }

  const result = await p.text({
    message: prompt.message,
    placeholder: prompt.placeholder,
    defaultValue: prompt.defaultValue,
    validate:
      prompt.validate ??
      ((v) =>
        !prompt.defaultValue && (!v || v.length === 0)
          ? `${prompt.message} is required`
          : undefined),
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
  if (value !== undefined) {
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
  const emptyFlags = fields.filter(
    (f) => f.required !== false && current[f.flag] === '',
  );
  if (emptyFlags.length > 0) {
    const flags = emptyFlags.map((f) => `--${f.flag}`).join(', ');
    outputError(
      {
        message: `Empty value for required flags: ${flags}`,
        code: 'invalid_options',
      },
      { json: globalOpts.json },
    );
  }

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
            defaultValue: field.defaultValue,
            validate:
              field.validate ??
              ((v) =>
                !field.defaultValue && (!v || v.length === 0)
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

// ─── Item picker ──────────────────────────────────────────────────────────────

const PICKER_PAGE_SIZE = 20;
const NEXT_PAGE = '__next_page__';
const PREV_PAGE = '__prev_page__';
const NONE = '__none__';

export type PickerConfig<T extends { id: string }> = {
  resource: string;
  resourcePlural: string;
  fetchItems: (
    resend: Resend,
    opts: { limit: number; after?: string },
  ) => Promise<{
    data: { data: T[]; has_more?: boolean } | null;
    error: { message: string } | null;
  }>;
  display: (item: T) => { label: string; hint?: string };
  filter?: (item: T) => boolean;
};

export type PickedItem = { readonly id: string; readonly label: string };

export async function pickItem<T extends { id: string }>(
  id: string | undefined,
  config: PickerConfig<T>,
  globalOpts: GlobalOpts,
): Promise<PickedItem>;
export async function pickItem<T extends { id: string }>(
  id: string | undefined,
  config: PickerConfig<T>,
  globalOpts: GlobalOpts,
  opts: { optional: true },
): Promise<PickedItem | undefined>;
export async function pickItem<T extends { id: string }>(
  id: string | undefined,
  config: PickerConfig<T>,
  globalOpts: GlobalOpts,
  opts?: { optional?: boolean },
): Promise<PickedItem | undefined> {
  if (id) {
    return { id, label: id };
  }

  const optional = opts?.optional ?? false;

  if (!isInteractive() || globalOpts.json) {
    if (optional) {
      return undefined;
    }
    outputError(
      { message: 'Missing required argument: id', code: 'missing_id' },
      { json: globalOpts.json },
    );
  }

  const resend = await requireClient(globalOpts);

  const fetchPage = async (
    cursors: readonly (string | undefined)[],
    pageIndex: number,
  ): Promise<PickedItem | undefined> => {
    const cursor = cursors[pageIndex];
    const spinner = createSpinner(
      pageIndex === 0
        ? `Fetching ${config.resourcePlural}...`
        : `Fetching ${config.resourcePlural} (page ${pageIndex + 1})...`,
      globalOpts.quiet,
    );

    const result = await config.fetchItems(resend, {
      limit: PICKER_PAGE_SIZE,
      ...(cursor && { after: cursor }),
    });

    if (result.error || !result.data) {
      if (optional) {
        spinner.clear();
        return undefined;
      }
      spinner.fail(`Failed to fetch ${config.resourcePlural}`);
      return outputError(
        {
          message: result.error?.message ?? 'Unexpected empty response',
          code: 'list_error',
        },
        { json: globalOpts.json },
      );
    }

    const pageItems = result.data.data;
    const hasMore = result.data.has_more ?? false;

    const nextCursors =
      hasMore && cursors.length === pageIndex + 1
        ? (() => {
            const lastItem = pageItems.at(-1);
            return lastItem ? [...cursors, lastItem.id] : cursors;
          })()
        : cursors;

    const displayItems = config.filter
      ? pageItems.filter(config.filter)
      : pageItems;

    if (displayItems.length === 0 && !hasMore && pageIndex === 0 && optional) {
      spinner.clear();
      return undefined;
    }

    spinner.stop(`${config.resourcePlural} fetched`);

    if (displayItems.length === 0 && !hasMore && pageIndex === 0) {
      p.log.warn(`No ${config.resourcePlural} found.`);
      return outputError(
        {
          message: `No ${config.resourcePlural} found.`,
          code: 'no_items',
        },
        { json: globalOpts.json },
      );
    }

    if (displayItems.length === 0 && config.filter) {
      p.log.info(`No matching ${config.resourcePlural} on this page.`);
    }

    const itemOptions = displayItems.map((item) => ({
      item,
      ...config.display(item),
    }));

    const options: { value: string; label: string; hint?: string }[] = [
      ...(pageIndex > 0
        ? [{ value: PREV_PAGE, label: '\u2190 Previous page' }]
        : []),
      ...(optional ? [{ value: NONE, label: 'None' }] : []),
      ...itemOptions.map(({ item, label, hint }) => ({
        value: item.id,
        label,
        hint,
      })),
      ...(hasMore ? [{ value: NEXT_PAGE, label: 'Next page \u2192' }] : []),
    ];

    const selected = await p.select({
      message: `Select a ${config.resource}`,
      options,
    });

    if (p.isCancel(selected)) {
      cancelAndExit('Cancelled.');
    }

    if (selected === NONE) {
      return undefined;
    }

    if (selected === NEXT_PAGE) {
      return fetchPage(nextCursors, pageIndex + 1);
    }

    if (selected === PREV_PAGE) {
      return fetchPage(nextCursors, pageIndex - 1);
    }

    const match = itemOptions.find(({ item }) => item.id === selected);
    return { id: selected, label: match?.label ?? selected };
  };

  return fetchPage([undefined], 0);
}

export async function pickId<T extends { id: string }>(
  id: string | undefined,
  config: PickerConfig<T>,
  globalOpts: GlobalOpts,
): Promise<string>;
export async function pickId<T extends { id: string }>(
  id: string | undefined,
  config: PickerConfig<T>,
  globalOpts: GlobalOpts,
  opts: { optional: true },
): Promise<string | undefined>;
export async function pickId<T extends { id: string }>(
  id: string | undefined,
  config: PickerConfig<T>,
  globalOpts: GlobalOpts,
  opts?: { optional?: boolean },
): Promise<string | undefined> {
  const result = await pickItem(id, config, globalOpts, opts as never);
  return result?.id;
}
