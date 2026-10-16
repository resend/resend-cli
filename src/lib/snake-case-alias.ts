import { Option } from '@commander-js/extra-typings';

export function hiddenAlias<Target extends string>(
  flags: string,
  target: Target,
): Option<Target> {
  const targetAttribute = new Option(target).attributeName();
  const alias = new Option(flags).hideHelp();
  // Commander has no option aliases, so the hidden spelling writes to the target attribute.
  alias.attributeName = () => targetAttribute;
  return alias as unknown as Option<Target>;
}

export function snakeCaseAlias<Usage extends string>(
  flags: Usage,
): Option<Usage> {
  const long = new Option(flags).long ?? '';
  return hiddenAlias(
    flags.replace(long, `--${long.slice(2).replaceAll('-', '_')}`),
    flags,
  );
}
