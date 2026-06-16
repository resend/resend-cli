import { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';
import {
  editDistance,
  enhanceCommandError,
} from '../../src/lib/command-suggestions';

const EXCESS_ARGS =
  'error: too many arguments. Expected 0 arguments but got 1.\n';

const COMMAND_SUGGESTION_MAX_DISTANCE = 3;

function buildProgram(): Command {
  const program = new Command('resend')
    .option('--api-key <key>', 'API key')
    .option('-p, --profile <name>', 'Profile name')
    .option('--json', 'JSON output')
    .option('-q, --quiet', 'Quiet output');

  const contacts = new Command('contacts')
    .addCommand(new Command('list').alias('ls'), { isDefault: true })
    .addCommand(new Command('get').argument('[id]'))
    .addCommand(new Command('delete').alias('rm'));

  const receiving = new Command('receiving')
    .addCommand(new Command('list'), { isDefault: true })
    .addCommand(new Command('attachments'))
    .addCommand(new Command('attachment'));

  const emails = new Command('emails')
    .addCommand(new Command('list'), { isDefault: true })
    .addCommand(new Command('send'))
    .addCommand(receiving);

  program
    .addCommand(contacts)
    .addCommand(emails)
    .addCommand(new Command('telemetry'), { hidden: true });

  return program;
}

function plainLevenshteinDistance(a: string, b: string): number {
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
    }
  }

  return distances[a.length][b.length];
}

describe('enhanceCommandError', () => {
  it('suggests a top-level command for a singular typo', () => {
    expect(enhanceCommandError(EXCESS_ARGS, buildProgram(), ['contact'])).toBe(
      "error: unknown command 'contact'\n\nDid you mean this?\n\tresend contacts\n",
    );
  });

  it('suggests nested commands hidden by a default list command', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), ['contacts', 'lsti']),
    ).toBe(
      "error: unknown command 'lsti'\n\nDid you mean this?\n\tresend contacts list\n",
    );
  });

  it('suggests deeply nested commands', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), [
        'emails',
        'receiving',
        'attchments',
      ]),
    ).toBe(
      "error: unknown command 'attchments'\n\nDid you mean this?\n\tresend emails receiving attachments\n",
    );
  });

  it('skips global option values before suggesting commands', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), [
        '--profile',
        'contact',
        'contatcs',
      ]),
    ).toBe(
      "error: unknown command 'contatcs'\n\nDid you mean this?\n\tresend contacts\n",
    );
  });

  it('consumes empty-string optional option values before suggesting commands', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), [
        '--profile',
        '',
        'contatcs',
      ]),
    ).toBe(
      "error: unknown command 'contatcs'\n\nDid you mean this?\n\tresend contacts\n",
    );
  });

  it('uses aliases to find suggestions but prints canonical command names', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), ['contacts', 'sl']),
    ).toBe(
      "error: unknown command 'sl'\n\nDid you mean this?\n\tresend contacts list\n",
    );
  });

  it('does not suggest commands for real extra positional arguments', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), [
        'contacts',
        'someone@example.com',
      ]),
    ).toBe(EXCESS_ARGS);
  });

  it('does not duplicate existing unknown option suggestions', () => {
    const unknownOption =
      "error: unknown option '--jsn'\n(Did you mean --json?)\n";

    expect(enhanceCommandError(unknownOption, buildProgram(), ['--jsn'])).toBe(
      unknownOption,
    );
  });

  it('does not suggest hidden commands', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), ['telemetri']),
    ).toBe(EXCESS_ARGS);
  });
});

describe('editDistance', () => {
  it.each([
    ['identical strings', 'contacts', 'contacts', 0],
    ['empty strings', '', '', 0],
    ['empty to non-empty', '', 'list', 4],
    ['single insertion', 'contact', 'contacts', 1],
    ['single deletion', 'contacts', 'contact', 1],
    ['single substitution', 'contect', 'contact', 1],
    ['adjacent transposition', 'sl', 'ls', 1],
    ['transposition in longer strings', 'contatcs', 'contacts', 1],
    ['multiple edits within threshold', 'lsti', 'list', 2],
    ['missing character typo', 'attchments', 'attachments', 1],
    ['trailing typo', 'telemetri', 'telemetry', 1],
    ['unrelated strings', 'abc', 'xyz', 3],
    ['classic damerau example', 'ca', 'abc', 3],
  ] as const)('%s', (_label, a, b, expected) => {
    expect(editDistance(a, b)).toBe(expected);
    expect(editDistance(b, a)).toBe(expected);
  });

  it('treats adjacent transpositions as one edit, unlike plain Levenshtein', () => {
    expect(editDistance('sl', 'ls')).toBe(1);
    expect(plainLevenshteinDistance('sl', 'ls')).toBe(2);
  });

  it('short-circuits when length difference exceeds maxLengthDifference', () => {
    expect(editDistance('a', 'abcdef', COMMAND_SUGGESTION_MAX_DISTANCE)).toBe(
      6,
    );
    expect(editDistance('abcdef', 'a', COMMAND_SUGGESTION_MAX_DISTANCE)).toBe(
      6,
    );
  });

  it('still computes exact distance when length difference is within threshold', () => {
    expect(editDistance('abcd', 'abef', COMMAND_SUGGESTION_MAX_DISTANCE)).toBe(
      2,
    );
  });

  it('computes exact distance when maxLengthDifference is not provided', () => {
    expect(editDistance('short', 'much-longer-string')).toBe(14);
  });

  it('keeps alias typo matches inside suggestion thresholds', () => {
    const typo = 'sl';
    const alias = 'ls';
    const distance = editDistance(typo, alias, COMMAND_SUGGESTION_MAX_DISTANCE);
    const similarity =
      (Math.max(typo.length, alias.length) - distance) /
      Math.max(typo.length, alias.length);

    expect(distance).toBeLessThanOrEqual(COMMAND_SUGGESTION_MAX_DISTANCE);
    expect(similarity).toBeGreaterThan(0.4);
  });
});
