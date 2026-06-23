import { describe, expect, it } from 'vitest';
import { sanitizeTerminalText } from '../../src/lib/sanitize-terminal-text';

describe('sanitizeTerminalText', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeTerminalText('Hello World')).toBe('Hello World');
  });

  it('strips ANSI color sequences', () => {
    expect(sanitizeTerminalText('\x1b[31mred text\x1b[0m')).toBe('red text');
  });

  it('strips OSC 52 clipboard write sequences', () => {
    expect(sanitizeTerminalText('\x1b]52;c;Zm9v\x07Invoice')).toBe('Invoice');
  });

  it('strips OSC 8 hyperlink sequences', () => {
    const input = '\x1b]8;;https://evil.com\x07Click here\x1b]8;;\x07';
    expect(sanitizeTerminalText(input)).toBe('Click here');
  });

  it('strips C0 control characters', () => {
    expect(sanitizeTerminalText('line1\x00line2\x01line3')).toBe(
      'line1line2line3',
    );
  });

  it('strips C1 control characters', () => {
    expect(sanitizeTerminalText('before\x8dafter')).toBe('beforeafter');
  });

  it('strips cursor movement sequences', () => {
    expect(sanitizeTerminalText('\x1b[2J\x1b[HFake prompt')).toBe(
      'Fake prompt',
    );
  });

  it('handles empty string', () => {
    expect(sanitizeTerminalText('')).toBe('');
  });

  it('preserves unicode text after stripping escapes', () => {
    expect(sanitizeTerminalText('\x1b[1mCafé ☕\x1b[0m')).toBe('Café ☕');
  });
});
