import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

function loadDotenv() {
  try {
    const content = readFileSync('.env', 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
      if (match) {
        process.env[match[1]] ??= match[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  } catch {}
}

loadDotenv();

const posthogKey = process.env.POSTHOG_PUBLIC_KEY ?? '';

await build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  minify: true,
  outfile: 'dist/cli.cjs',
  external: ['esbuild', 'esbuild-wasm'],
  define: {
    'process.env.POSTHOG_PUBLIC_KEY': JSON.stringify(posthogKey),
  },
});
