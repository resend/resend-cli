import type { Command, Option } from '@commander-js/extra-typings';

const MAX_DISTANCE = 3;
const MIN_SIMILARITY = 0.4;

type InternalCommand = Command & {
  _hidden?: boolean;
  commands: Command[];
};

type InstallOptions = {
  getArgv?: () => string[];
};

type CommandSuggestion = {
  unknownCommand: string;
  suggestions: string[];
}

type OutputConfiguration = ReturnType<Command['configureOutput']>;

export function installCommandSuggestions(
  root: Command,
  opts: InstallOptions = {},
): void {
  const getArgv = opts.getArgv ?? (() => process.argv.slice(2));

  for (const command of walkCommands(root)) {
    const output = command.configureOutput() as OutputConfiguration;
    const outputError = output.outputError ?? ((str, write) => write(str));

    command.configureOutput({
      outputError: (str, write) => {
        outputError(enhanceCommandError(str, root, getArgv()), write);
      },
    });
  }
}

export function enhanceCommandError(
  errorText: string,
  root: Command,
  argv: string[],
): string {
  if (!isCommandError(errorText)) {
    return errorText;
  }

  const suggestion = getCommandSuggestion(root, argv);
  if (!suggestion) {
    return errorText;
  }

  return formatSuggestion(errorText, suggestion);
}

export function getCommandSuggestion(
  root: Command,
  argv: string[],
): CommandSuggestion | undefined {
  let current = root;
  const path: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token || token === '--') {
      return undefined;
    }

    const nextIndex = skipOption(argv, index, current);
    if (nextIndex === undefined) {
      return undefined;
    }
    if (nextIndex !== index) {
      index = nextIndex - 1;
      continue;
    }

    if (token.startsWith('-')) {
      return undefined;
    }

    const exact = findCommand(current, token);
    if (exact) {
      current = exact;
      path.push(exact.name());
      continue;
    }

    const suggestions = suggestCommands(token, visibleSubcommands(current)).map(
      (command) => [root.name(), ...path, command.name()].join(' '),
    );

    if (suggestions.length === 0) {
      return undefined;
    }

    return {
      unknownCommand: token,
      suggestions,
    };
  }

  return undefined;
}

function isCommandError(errorText: string): boolean {
  return (
    /^error: unknown command /.test(errorText) ||
    /^error: too many arguments/.test(errorText)
  );
}

function formatSuggestion(
  errorText: string,
  suggestion: CommandSuggestion,
): string {
  const trailingNewline = errorText.endsWith('\n') ? '\n' : '';
  const suggestions = suggestion.suggestions;
  const didYouMean =
    suggestions.length === 1
      ? `Did you mean ${suggestions[0]}?`
      : `Did you mean one of ${suggestions.join(', ')}?`;

  return `error: unknown command '${suggestion.unknownCommand}'\n(${didYouMean})${trailingNewline}`;
}

function walkCommands(root: Command): Command[] {
  const commands: Command[] = [root];

  for (const subcommand of (root as InternalCommand).commands) {
    commands.push(...walkCommands(subcommand));
  }

  return commands;
}

function skipOption(
  argv: string[],
  index: number,
  current: Command,
): number | undefined {
  const token = argv[index];

  if (!token.startsWith('-') || token === '-') {
    return index;
  }

  const option = findOption(current, token);
  if (!option) {
    return undefined;
  }

  if (!option.required && !option.optional) {
    return index + 1;
  }

  if (option.variadic) {
    return argv.length;
  }

  if (token.startsWith('--') && token.includes('=')) {
    return index + 1;
  }

  if (!token.startsWith('--') && token.length > 2) {
    return index + 1;
  }

  const next = argv[index + 1];
  if (option.optional && (!next || next.startsWith('-'))) {
    return index + 1;
  }

  return Math.min(index + 2, argv.length);
}

function findOption(current: Command, token: string): Option | undefined {
  const flag = optionFlag(token);

  for (const command of commandAndAncestors(current)) {
    for (const option of command.createHelp().visibleOptions(command)) {
      if (option.long === flag || option.short === flag) {
        return option;
      }
    }
  }

  return undefined;
}

function optionFlag(token: string): string {
  if (token.startsWith('--')) {
    return token.split('=', 1)[0];
  }

  return token.length > 2 ? token.slice(0, 2) : token;
}

function commandAndAncestors(command: Command): Command[] {
  const commands: Command[] = [];

  for (
    let current: Command | undefined = command;
    current;
    current = current.parent as Command | undefined
  ) {
    commands.push(current);
  }

  return commands;
}

function findCommand(parent: Command, name: string): Command | undefined {
  return subcommands(parent).find((command) => commandNames(command).has(name));
}

function visibleSubcommands(parent: Command): Command[] {
  return parent
    .createHelp()
    .visibleCommands(parent)
    .filter((command) => !(command as InternalCommand)._hidden) as Command[];
}

function subcommands(parent: Command): Command[] {
  const commands = [...(parent as InternalCommand).commands];

  for (const command of visibleSubcommands(parent)) {
    if (!commands.includes(command)) {
      commands.push(command);
    }
  }

  return commands;
}

function commandNames(command: Command): Set<string> {
  return new Set([command.name(), ...command.aliases()]);
}

function suggestCommands(unknown: string, commands: Command[]): Command[] {
  const matches = commands
    .map((command) => {
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const name of commandNames(command)) {
        if (name.length <= 1) {
          continue;
        }

        const distance = editDistance(unknown, name);
        const length = Math.max(unknown.length, name.length);
        const similarity = (length - distance) / length;

        if (
          distance <= MAX_DISTANCE &&
          similarity > MIN_SIMILARITY &&
          distance < bestDistance
        ) {
          bestDistance = distance;
        }
      }

      return { command, distance: bestDistance };
    })
    .filter((match) => Number.isFinite(match.distance));

  if (matches.length === 0) {
    return [];
  }

  const bestDistance = Math.min(...matches.map((match) => match.distance));

  return matches
    .filter((match) => match.distance === bestDistance)
    .sort((a, b) => a.command.name().localeCompare(b.command.name()))
    .map((match) => match.command);
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > MAX_DISTANCE) {
    return Math.max(a.length, b.length);
  }

  const distances: number[][] = [];

  for (let i = 0; i <= a.length; i += 1) {
    distances[i] = [i];
  }

  for (let j = 0; j <= b.length; j += 1) {
    distances[0][j] = j;
  }

  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distances[i][j] = Math.min(
          distances[i][j],
          distances[i - 2][j - 2] + 1,
        );
      }
    }
  }

  return distances[a.length][b.length];
}
