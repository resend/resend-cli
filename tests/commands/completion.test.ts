import { Command, Option } from '@commander-js/extra-typings';
import { describe, expect, test } from 'vitest';
import {
  type CommandNode,
  collectCommandTree,
  generateBashCompletion,
  generateFishCompletion,
  generatePowerShellCompletion,
  generateZshCompletion,
} from '../../src/lib/completion';

function buildTestProgram(): Command {
  const program = new Command('myapp')
    .description('Test CLI')
    .option('--verbose', 'Enable verbose output')
    .option('-p, --profile <name>', 'Profile name');

  const emails = new Command('emails').description('Manage emails');
  emails
    .command('send')
    .description('Send an email')
    .option('--from <address>', 'Sender')
    .option('--to <address>', 'Recipient')
    .addOption(
      new Option('--priority <level>', 'Priority').choices([
        'low',
        'normal',
        'high',
      ]),
    );
  emails.command('list').description('List emails').alias('ls');

  program.addCommand(emails);

  const hidden = new Command('secret').description('Hidden command');
  (hidden as unknown as { _hidden: boolean })._hidden = true;
  program.addCommand(hidden);

  const domains = new Command('domains').description('Manage domains');
  domains
    .command('delete')
    .description('Delete a domain')
    .alias('rm')
    .option('--yes', 'Skip confirmation');
  program.addCommand(domains);

  return program;
}

describe('collectCommandTree', () => {
  test('collects commands and subcommands', () => {
    const tree = collectCommandTree(buildTestProgram());
    expect(tree.name).toBe('myapp');
    const names = tree.subcommands.map((s) => s.name);
    expect(names).toContain('emails');
    expect(names).toContain('domains');
  });

  test('excludes hidden commands', () => {
    const tree = collectCommandTree(buildTestProgram());
    const names = tree.subcommands.map((s) => s.name);
    expect(names).not.toContain('secret');
  });

  test('collects aliases', () => {
    const tree = collectCommandTree(buildTestProgram());
    const emails = tree.subcommands.find((s) => s.name === 'emails');
    expect(emails).toBeDefined();
    const list = emails?.subcommands.find((s) => s.name === 'list');
    expect(list).toBeDefined();
    expect(list?.aliases).toContain('ls');
  });

  test('collects options with choices', () => {
    const tree = collectCommandTree(buildTestProgram());
    const emails = tree.subcommands.find((s) => s.name === 'emails');
    expect(emails).toBeDefined();
    const send = emails?.subcommands.find((s) => s.name === 'send');
    expect(send).toBeDefined();
    const priority = send?.options.find((o) => o.long === '--priority');
    expect(priority).toBeDefined();
    expect(priority?.choices).toEqual(['low', 'normal', 'high']);
    expect(priority?.takesValue).toBe(true);
  });

  test('collects global options', () => {
    const tree = collectCommandTree(buildTestProgram());
    const verbose = tree.options.find((o) => o.long === '--verbose');
    expect(verbose).toBeDefined();
    expect(verbose?.takesValue).toBe(false);
  });

  test('excludes hidden options', () => {
    const program = new Command('test').description('Test');
    const hiddenOpt = new Option('--secret', 'Hidden option');
    hiddenOpt.hidden = true;
    program.addOption(hiddenOpt);
    program.option('--visible', 'Visible option');

    const tree = collectCommandTree(program);
    const names = tree.options.map((o) => o.long);
    expect(names).not.toContain('--secret');
    expect(names).toContain('--visible');
  });
});

function getTestTree(): CommandNode {
  return collectCommandTree(buildTestProgram());
}

describe('generateBashCompletion', () => {
  test('outputs valid bash completion script', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toContain('_myapp_completions');
    expect(output).toContain('complete -F _myapp_completions myapp');
  });

  test('includes top-level commands', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toContain('emails');
    expect(output).toContain('domains');
  });

  test('excludes hidden commands', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).not.toContain('secret');
  });

  test('includes subcommands', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toContain('send');
    expect(output).toContain('list');
  });

  test('includes aliases', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toMatch(/\bls\b/);
    expect(output).toMatch(/\brm\b/);
  });

  test('includes option choices', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toContain('low');
    expect(output).toContain('normal');
    expect(output).toContain('high');
    expect(output).toContain('--priority');
  });

  test('includes global options', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toContain('--verbose');
    expect(output).toContain('--profile');
  });

  test('skips option values when building cmd_path', () => {
    const output = generateBashCompletion(getTestTree());
    expect(output).toContain('--profile|-p|--from|--to|--priority)');
    expect(output).toContain('i=$((i + 1)) ;;');
  });
});

describe('generateZshCompletion', () => {
  test('outputs valid zsh completion script', () => {
    const output = generateZshCompletion(getTestTree());
    expect(output).toContain('#compdef myapp');
    expect(output).toContain('compdef _myapp myapp');
    expect(output).toContain('_myapp()');
  });

  test('includes commands and options', () => {
    const output = generateZshCompletion(getTestTree());
    expect(output).toContain('emails');
    expect(output).toContain('--verbose');
    expect(output).toContain('--priority');
  });

  test('excludes hidden commands', () => {
    const output = generateZshCompletion(getTestTree());
    expect(output).not.toContain('secret');
  });
});

describe('generateFishCompletion', () => {
  test('outputs fish completion commands', () => {
    const output = generateFishCompletion(getTestTree());
    expect(output).toContain('complete -c myapp');
    expect(output).toContain('__fish_use_subcommand');
  });

  test('includes subcommand completions', () => {
    const output = generateFishCompletion(getTestTree());
    expect(output).toContain('__fish_seen_subcommand_from');
    expect(output).toContain('send');
  });

  test('includes option choices', () => {
    const output = generateFishCompletion(getTestTree());
    expect(output).toContain('low normal high');
  });

  test('excludes hidden commands', () => {
    const output = generateFishCompletion(getTestTree());
    expect(output).not.toContain('secret');
  });
});

describe('generatePowerShellCompletion', () => {
  test('outputs PowerShell completion script', () => {
    const output = generatePowerShellCompletion(getTestTree());
    expect(output).toContain('Register-ArgumentCompleter');
    expect(output).toContain('-CommandName myapp');
  });

  test('includes commands and options', () => {
    const output = generatePowerShellCompletion(getTestTree());
    expect(output).toContain('"emails"');
    expect(output).toContain('"--verbose"');
  });

  test('excludes hidden commands', () => {
    const output = generatePowerShellCompletion(getTestTree());
    expect(output).not.toContain('secret');
  });

  test('groups choice values per flag in switch', () => {
    const output = generatePowerShellCompletion(getTestTree());
    expect(output).toContain('"--priority" { @("low", "normal", "high")');
  });

  test('skips option values when building cmdPath', () => {
    const output = generatePowerShellCompletion(getTestTree());
    expect(output).toContain('$valueFlags -contains $words[$i]');
  });
});
