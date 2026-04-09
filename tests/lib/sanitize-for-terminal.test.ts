import { describe, expect, it } from 'vitest';
import { sanitizeForTerminal } from '../../src/lib/sanitize-for-terminal';

describe('sanitizeForTerminal', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeForTerminal('Hello, world!')).toBe('Hello, world!');
  });

  it('strips ESC (\\x1b) characters', () => {
    expect(sanitizeForTerminal('\x1b[2J\x1b[HFAKE STATUS')).toBe(
      '[2J[HFAKE STATUS',
    );
  });

  it('strips CSI (\\x9b) characters', () => {
    expect(sanitizeForTerminal('\x9b31mRed text\x9b0m')).toBe('31mRed text0m');
  });

  it('strips null bytes and C0 control characters', () => {
    expect(sanitizeForTerminal('hello\x00\x01\x02\x07world')).toBe(
      'helloworld',
    );
  });

  it('preserves tabs and newlines', () => {
    expect(sanitizeForTerminal('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('strips DEL (\\x7f) and C1 control range', () => {
    expect(sanitizeForTerminal('abc\x7f\x80\x8f\x9fdef')).toBe('abcdef');
  });

  it('strips a full ANSI escape sequence leaving bracket content', () => {
    const input = '\x1b[31mError\x1b[0m';
    expect(sanitizeForTerminal(input)).toBe('[31mError[0m');
  });

  it('strips OSC sequences used for hyperlink injection', () => {
    const input = '\x1b]8;;https://evil.example\x1b\\Click me\x1b]8;;\x1b\\';
    const result = sanitizeForTerminal(input);
    expect(result).not.toContain('\x1b');
    expect(result).toContain('Click me');
  });

  it('handles an empty string', () => {
    expect(sanitizeForTerminal('')).toBe('');
  });

  it('preserves unicode text and emoji', () => {
    expect(sanitizeForTerminal('Caf\u00e9 \u2603 \u{1F600}')).toBe(
      'Caf\u00e9 \u2603 \u{1F600}',
    );
  });
});
