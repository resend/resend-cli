import { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';
import { enhanceCommandError } from '../../src/lib/command-suggestions';

const EXCESS_ARGS =
  'error: too many arguments. Expected 0 arguments but got 1.\n';

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

describe('enhanceCommandError', () => {
  it('suggests a top-level command for a singular typo', () => {
    expect(enhanceCommandError(EXCESS_ARGS, buildProgram(), ['contact'])).toBe(
      "error: unknown command 'contact'\n(Did you mean resend contacts?)\n",
    );
  });

  it('suggests nested commands hidden by a default list command', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), ['contacts', 'lsti']),
    ).toBe(
      "error: unknown command 'lsti'\n(Did you mean resend contacts list?)\n",
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
      "error: unknown command 'attchments'\n(Did you mean resend emails receiving attachments?)\n",
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
      "error: unknown command 'contatcs'\n(Did you mean resend contacts?)\n",
    );
  });

  it('uses aliases to find suggestions but prints canonical command names', () => {
    expect(
      enhanceCommandError(EXCESS_ARGS, buildProgram(), ['contacts', 'sl']),
    ).toBe(
      "error: unknown command 'sl'\n(Did you mean resend contacts list?)\n",
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
