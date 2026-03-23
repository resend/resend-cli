import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildEquivalentCommand,
  type CommandHintFlag,
  printCommandHint,
} from '../../src/lib/command-hint';

describe('buildEquivalentCommand', () => {
  test('returns base command when no flags', () => {
    expect(buildEquivalentCommand('resend domains create', [])).toBe(
      'resend domains create',
    );
  });

  test('appends simple string flags', () => {
    const flags: CommandHintFlag[] = [
      { flag: 'name', value: 'example.com' },
      { flag: 'region', value: 'us-east-1' },
    ];
    expect(buildEquivalentCommand('resend domains create', flags)).toBe(
      'resend domains create --name example.com --region us-east-1',
    );
  });

  test('quotes values with spaces', () => {
    const flags: CommandHintFlag[] = [
      { flag: 'subject', value: 'Hello World' },
    ];
    expect(buildEquivalentCommand('resend emails send', flags)).toBe(
      "resend emails send --subject 'Hello World'",
    );
  });

  test('escapes single quotes in values', () => {
    const flags: CommandHintFlag[] = [{ flag: 'text', value: "it's here" }];
    expect(buildEquivalentCommand('resend emails send', flags)).toBe(
      "resend emails send --text 'it'\\''s here'",
    );
  });

  test('quotes empty string values', () => {
    const flags: CommandHintFlag[] = [{ flag: 'name', value: '' }];
    expect(buildEquivalentCommand('resend test', flags)).toBe('resend test');
  });

  test('handles boolean flags', () => {
    const flags: CommandHintFlag[] = [
      { flag: 'name', value: 'example.com' },
      { flag: 'receiving', value: true },
    ];
    expect(buildEquivalentCommand('resend domains create', flags)).toBe(
      'resend domains create --name example.com --receiving',
    );
  });

  test('handles array values as repeated flags', () => {
    const flags: CommandHintFlag[] = [
      { flag: 'to', value: ['a@x.com', 'b@x.com'] },
    ];
    expect(buildEquivalentCommand('resend emails send', flags)).toBe(
      'resend emails send --to a@x.com --to b@x.com',
    );
  });

  test('truncates values longer than 120 chars', () => {
    const long = 'a'.repeat(200);
    const flags: CommandHintFlag[] = [{ flag: 'html', value: long }];
    const result = buildEquivalentCommand('resend emails send', flags);
    expect(result).toContain('...');
    expect(result).not.toContain(long);
  });

  test('quotes values with shell metacharacters', () => {
    const flags: CommandHintFlag[] = [{ flag: 'html', value: '<b>Hello</b>' }];
    expect(buildEquivalentCommand('resend emails send', flags)).toBe(
      "resend emails send --html '<b>Hello</b>'",
    );
  });

  test('does not quote simple email addresses', () => {
    const flags: CommandHintFlag[] = [
      { flag: 'from', value: 'noreply@example.com' },
    ];
    expect(buildEquivalentCommand('resend emails send', flags)).toBe(
      'resend emails send --from noreply@example.com',
    );
  });
});

describe('printCommandHint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('prints equivalent command label and command', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printCommandHint('resend domains create --name example.com');
    expect(logSpy).toHaveBeenCalledTimes(2);
    const calls = logSpy.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toContain('Equivalent command:');
    expect(calls[1]).toContain('resend domains create --name example.com');
  });
});
