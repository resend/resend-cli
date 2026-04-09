import { describe, expect, it } from 'vitest';
import { buildHelpText } from '../../src/lib/help-text';

describe('buildHelpText', () => {
  it('full leaf command — all options, setup: false', () => {
    const result = buildHelpText({
      context: 'Some context line\n\nNon-interactive: --required-flag <value>',
      output: '  {"id":"em_123"}',
      errorCodes: ['auth_error', 'send_error'],
      examples: [
        'resend emails send --to user@example.com --subject Hi --text Hello',
      ],
      setup: false,
    });

    expect(result).toBe(
      '\n' +
        'Some context line\n\nNon-interactive: --required-flag <value>' +
        '\n\n' +
        'Global options:\n' +
        '  --api-key <key>     API key (or set RESEND_API_KEY env var)\n' +
        '  -p, --profile <name>  Profile to use (overrides RESEND_PROFILE)\n' +
        '  --json              Force JSON output (also auto-enabled when stdout is piped)\n' +
        '  -q, --quiet         Suppress spinners and status output (implies --json)' +
        '\n\n' +
        'Output (--json or piped):\n' +
        '  {"id":"em_123"}' +
        '\n\n' +
        'Errors (exit code 1, JSON on stderr when using --json or non-TTY):\n' +
        '  {"error":{"message":"<message>","code":"<code>"}}\n' +
        '  Codes: auth_error | send_error' +
        '\n\n' +
        'Examples:\n' +
        '  $ resend emails send --to user@example.com --subject Hi --text Hello',
    );
  });

  it('setup variant — no --api-key line, short --json form', () => {
    const result = buildHelpText({
      context: 'Setup context',
      output: '  {"configured":true}',
      errorCodes: ['write_error'],
      examples: ['resend setup cursor'],
      setup: true,
    });

    expect(result).not.toContain('--api-key');
    expect(result).toContain('--json            Force JSON output');
    expect(result).toContain('Global options:');
  });

  it('index command — no output, no errorCodes', () => {
    const result = buildHelpText({
      context: 'Manage emails.',
      examples: ['resend emails send', 'resend emails receiving list'],
    });

    expect(result).not.toContain('Output (--json or piped):');
    expect(result).not.toContain('Errors (exit code 1):');
    expect(result).toContain('Global options:');
    expect(result).toContain('Examples:');
    expect(result).toContain('  $ resend emails send');
    expect(result).toContain('  $ resend emails receiving list');
  });

  it('no context — string starts with newline then Global options header directly', () => {
    const result = buildHelpText({
      output: '  {"id":"dm_abc"}',
      errorCodes: ['auth_error'],
      examples: ['resend domains list'],
    });

    expect(result.startsWith('\nGlobal options:')).toBe(true);
  });

  it('multi-line output — verbatim after the Output header', () => {
    const multiLineOutput =
      '  {"id":"em_123"}\n  // or with all fields:\n  {"id":"em_456","to":["a@b.com"]}';
    const result = buildHelpText({
      output: multiLineOutput,
      errorCodes: ['auth_error'],
      examples: ['resend emails send --to a@b.com --subject Hi --text Hi'],
    });

    expect(result).toContain(`Output (--json or piped):\n${multiLineOutput}`);
  });

  it('error codes join — uses " | " separator', () => {
    const result = buildHelpText({
      errorCodes: ['auth_error', 'list_error', 'fetch_error'],
      examples: ['resend domains list'],
    });

    expect(result).toContain('Codes: auth_error | list_error | fetch_error');
  });
});
