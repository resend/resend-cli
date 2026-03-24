import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { renderingUtilitiesExporter } from './esbuild/rendering-utilities-exporter';

export interface BundleResult {
  cjsPath: string;
  tmpDir: string;
}

export async function bundleReactEmail(
  templatePath: string,
): Promise<BundleResult> {
  const resolved = path.resolve(templatePath);
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'resend-react-email-'));

  try {
    await build({
      bundle: true,
      entryPoints: [resolved],
      format: 'cjs',
      jsx: 'automatic',
      logLevel: 'silent',
      outExtension: { '.js': '.cjs' },
      outdir: tmpDir,
      platform: 'node',
      plugins: [renderingUtilitiesExporter([resolved])],
      write: true,
    });
  } catch (err) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }

  const baseName = path.basename(resolved, path.extname(resolved));
  const cjsPath = path.join(tmpDir, `${baseName}.cjs`);
  return { cjsPath, tmpDir };
}
