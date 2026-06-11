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
};

export function installCommandSuggestions(
  root: Command,
  opts: InstallOptions = {},
): void {
  const getArgv = opts.getArgv ?? (() => process.argv.slice(2));

  const commands: Command[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const command = stack.pop();
    if (!command) {
      break;
    }

    commands.push(command);

    for (const subcommand of (command as InternalCommand).commands) {
      stack.push(subcommand);
    }
  }

  for (const command of commands) {
    const output = command.configureOutput();
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

    let nextIndex: number | undefined = index;

    if (token.startsWith('-') && token !== '-') {
      const flag = token.startsWith('--')
        ? token.split('=', 1)[0]
        : token.length > 2
          ? token.slice(0, 2)
          : token;

      let option: Option | undefined;

      for (const command of commandAndAncestors(current)) {
        for (const visibleOption of command
          .createHelp()
          .visibleOptions(command)) {
          if (visibleOption.long === flag || visibleOption.short === flag) {
            option = visibleOption;
            break;
          }
        }

        if (option) {
          break;
        }
      }

      if (!option) {
        nextIndex = undefined;
      } else if (!option.required && !option.optional) {
        nextIndex = index + 1;
      } else if (option.variadic) {
        nextIndex = argv.length;
      } else if (token.startsWith('--') && token.includes('=')) {
        nextIndex = index + 1;
      } else if (!token.startsWith('--') && token.length > 2) {
        nextIndex = index + 1;
      } else {
        const next = argv[index + 1];

        if (option.optional && (!next || next.startsWith('-'))) {
          nextIndex = index + 1;
        } else {
          nextIndex = Math.min(index + 2, argv.length);
        }
      }
    }

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

    const exact = subcommands(current).find((command) =>
      commandNames(command).has(token),
    );
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

        const distance = editDistance(unknown, name, MAX_DISTANCE);
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

export function editDistance(
  a: string,
  b: string,
  maxLengthDifference = Number.POSITIVE_INFINITY,
): number {
  if (Math.abs(a.length - b.length) > maxLengthDifference) {
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
