import { Option } from '@commander-js/extra-typings';

export function snakeCaseAlias<Usage extends string>(
  flags: Usage,
): Option<Usage> {
  const option = new Option(flags);
  const long = option.long ?? '';
  const alias = new Option(
    flags.replace(long, `--${long.slice(2).replaceAll('-', '_')}`),
  ).hideHelp();
  // Commander has no option aliases, so the hidden spelling writes to the kebab-case attribute.
  alias.attributeName = () => option.attributeName();
  return alias as unknown as Option<Usage>;
}
