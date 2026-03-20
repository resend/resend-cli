import { readFileSync } from 'node:fs';

const bundle = readFileSync('dist/cli.cjs', 'utf8');

if (!bundle.includes('phc_')) {
  console.error(
    'Error: POSTHOG_PUBLIC_KEY not found in bundle — add it to .env',
  );
  process.exit(1);
}
