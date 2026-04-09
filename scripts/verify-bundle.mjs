import { readFileSync } from 'node:fs';

const bundle = readFileSync('dist/cli.cjs', 'utf8');

if (!bundle.includes('phc_')) {
  console.error(
    'Error: POSTHOG_PUBLIC_KEY not found in bundle — add it to .env',
  );
  process.exit(1);
}

const esbuildBundledMarker = 'The esbuild JavaScript API cannot be bundled';
if (bundle.includes(esbuildBundledMarker)) {
  console.error(
    'Error: esbuild was inlined into the bundle — add it to the external list in scripts/build.mjs',
  );
  process.exit(1);
}

if (!bundle.includes('require("esbuild")')) {
  console.error(
    'Error: esbuild external require not found — ensure esbuild is externalized in scripts/build.mjs',
  );
  process.exit(1);
}
