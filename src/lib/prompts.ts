import * as p from '@clack/prompts';
import { isInteractive } from './tty';

export interface FieldSpec {
  flag: string;
  message: string;
  placeholder?: string;
  required?: boolean;
  validate?: (value: string | undefined) => string | undefined;
}

export async function promptForMissing<T extends Record<string, string | undefined>>(
  current: T,
  fields: FieldSpec[]
): Promise<T> {
  const missing = fields.filter((f) => f.required !== false && !current[f.flag]);

  if (missing.length === 0) return current;

  if (!isInteractive()) {
    const flags = missing.map((f) => `--${f.flag}`).join(', ');
    console.error(`Error: Missing required flags: ${flags}`);
    console.error('Provide all required flags in non-interactive mode.');
    process.exit(1);
  }

  const result = await p.group(
    Object.fromEntries(
      missing.map((field) => [
        field.flag,
        () =>
          p.text({
            message: field.message,
            placeholder: field.placeholder,
            validate: field.validate ?? ((v) => (!v || v.length === 0 ? `${field.message} is required` : undefined)),
          }),
      ])
    ),
    {
      onCancel: () => {
        p.cancel('Operation cancelled.');
        process.exit(0);
      },
    }
  );

  return { ...current, ...result } as T;
}
