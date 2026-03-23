import { rmSync } from 'node:fs';
import type { GlobalOpts } from './client';
import { errorMessage, outputError } from './output';
import { bundleReactEmail } from './react-email-bundler';
import { renderReactEmail } from './react-email-renderer';
import { createSpinner } from './spinner';

/**
 * Bundles and renders a React Email template (.tsx) to an HTML string.
 * Shows spinners for each phase and exits with the appropriate error code on failure.
 */
export async function buildReactEmailHtml(
  templatePath: string,
  globalOpts: GlobalOpts,
): Promise<string> {
  const spinner = createSpinner(
    'Bundling React Email template...',
    globalOpts.quiet,
  );
  let cjsPath: string;
  let tmpDir: string;
  try {
    const result = await bundleReactEmail(templatePath);
    cjsPath = result.cjsPath;
    tmpDir = result.tmpDir;
  } catch (err) {
    spinner.fail('Failed to bundle React Email template');
    return outputError(
      {
        message: errorMessage(err, 'Failed to bundle React Email template'),
        code: 'react_email_build_error',
      },
      { json: globalOpts.json },
    );
  }
  spinner.stop('Bundled React Email template');

  const renderSpinner = createSpinner(
    'Rendering React Email template...',
    globalOpts.quiet,
  );
  try {
    const html = await renderReactEmail(cjsPath);
    renderSpinner.stop('Rendered React Email template');
    return html;
  } catch (err) {
    renderSpinner.fail('Failed to render React Email template');
    return outputError(
      {
        message: errorMessage(err, 'Failed to render React Email template'),
        code: 'react_email_render_error',
      },
      { json: globalOpts.json },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
