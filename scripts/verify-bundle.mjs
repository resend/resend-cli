import { readFileSync } from 'node:fs';

const bundle = readFileSync('dist/cli.cjs', 'utf8');
const key = process.env.POSTHOG_PUBLIC_KEY ?? '';

if (key && !bundle.includes(key)) {
  console.error('Error: configured POSTHOG_PUBLIC_KEY was not found in bundle');
  process.exit(1);
}
