import { existsSync, readFileSync } from 'node:fs';
import type { GlobalOpts } from './client';
import { outputError } from './output';

export const parseReactEmailProps = (
  propsJson: string | undefined,
  propsFile: string | undefined,
  globalOpts: GlobalOpts,
): Record<string, unknown> => {
  if (propsJson && propsFile) {
    return outputError(
      {
        message:
          'Cannot use both --react-email-props and --react-email-props-file',
        code: 'invalid_options',
      },
      { json: globalOpts.json },
    );
  }

  if (!propsJson && !propsFile) {
    return {};
  }

  const raw = propsFile
    ? readPropsFile(propsFile, globalOpts)
    : (propsJson as string);

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return outputError(
        {
          message: 'React Email props must be a JSON object.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }
    return parsed as Record<string, unknown>;
  } catch {
    return outputError(
      {
        message: 'React Email props are not valid JSON.',
        code: 'invalid_options',
      },
      { json: globalOpts.json },
    );
  }
};

const readPropsFile = (filePath: string, globalOpts: GlobalOpts): string => {
  if (!existsSync(filePath)) {
    return outputError(
      {
        message: `File not found: ${filePath}`,
        code: 'file_read_error',
      },
      { json: globalOpts.json },
    );
  }
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return outputError(
      {
        message: `Failed to read file: ${filePath}`,
        code: 'file_read_error',
      },
      { json: globalOpts.json },
    );
  }
};
