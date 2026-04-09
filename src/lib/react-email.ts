import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GlobalOpts } from './client';
import { errorMessage, outputError } from './output';
import { bundleReactEmail } from './react-email-bundler';
import { renderReactEmail } from './react-email-renderer';
import { createSpinner } from './spinner';

const cleanupTmpDir = (tmpDir: string | undefined) => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
};

export const buildReactEmailHtml = async (
  templatePath: string,
  globalOpts: GlobalOpts,
  props: Record<string, unknown> = {},
): Promise<string> => {
  if ('pkg' in process) {
    return outputError(
      {
        message:
          '--react-email requires a Node.js install (npm i -g resend-cli or npx resend-cli)',
        code: 'react_email_build_error',
      },
      { json: globalOpts.json },
    );
  }

  const resolved = resolve(templatePath);
  if (!existsSync(resolved)) {
    return outputError(
      {
        message: `File not found: ${templatePath}`,
        code: 'react_email_build_error',
      },
      { json: globalOpts.json },
    );
  }

  const spinner = createSpinner(
    'Bundling React Email template...',
    globalOpts.quiet,
  );
  let tmpDir: string | undefined;
  try {
    const result = await bundleReactEmail(templatePath);
    tmpDir = result.tmpDir;
    spinner.stop('Bundled React Email template');

    const renderSpinner = createSpinner(
      'Rendering React Email template...',
      globalOpts.quiet,
    );
    try {
      const html = await renderReactEmail(result.cjsPath, props);
      renderSpinner.stop('Rendered React Email template');
      cleanupTmpDir(tmpDir);
      return html;
    } catch (err) {
      renderSpinner.fail('Failed to render React Email template');
      cleanupTmpDir(tmpDir);
      return outputError(
        {
          message: errorMessage(err, 'Failed to render React Email template'),
          code: 'react_email_render_error',
        },
        { json: globalOpts.json },
      );
    }
  } catch (err) {
    spinner.fail('Failed to bundle React Email template');
    cleanupTmpDir(tmpDir);
    return outputError(
      {
        message: errorMessage(err, 'Failed to bundle React Email template'),
        code: 'react_email_build_error',
      },
      { json: globalOpts.json },
    );
  }
};
