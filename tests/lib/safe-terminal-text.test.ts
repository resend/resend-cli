import { describe, expect, it } from 'vitest';
import { safeTerminalText } from '../../src/lib/safe-terminal-text';

describe('safeTerminalText', () => {
  it('returns plain strings unchanged', () => {
    expect(safeTerminalText('hello world')).toBe('hello world');
  });

  it('coerces non-string values via String()', () => {
    expect(safeTerminalText(42)).toBe('42');
    expect(safeTerminalText(null)).toBe('null');
    expect(safeTerminalText(undefined)).toBe('undefined');
    expect(safeTerminalText(true)).toBe('true');
  });

  it('strips ANSI escape sequences', () => {
    expect(safeTerminalText('\u001b[31mred text\u001b[0m')).toBe('red text');
  });

  it('strips OSC hyperlink sequences', () => {
    const input =
      '\u001b]8;;https://attacker.example\u0007CLICK HERE\u001b]8;;\u0007';
    expect(safeTerminalText(input)).toBe('CLICK HERE');
  });

  it('strips cursor movement sequences', () => {
    expect(safeTerminalText('\u001b[2K\u001b[1Aspoofed')).toBe('spoofed');
  });

  it('removes NUL and other C0 control characters', () => {
    expect(safeTerminalText('a\x00b\x01c\x02d')).toBe('abcd');
  });

  it('preserves tabs and newlines', () => {
    expect(safeTerminalText('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('removes DEL character (0x7F)', () => {
    expect(safeTerminalText('abc\x7Fdef')).toBe('abcdef');
  });

  it('handles combined VT + C0 control characters', () => {
    const input = '\u001b[1mBOLD\u001b[0m\x00\x01hidden';
    expect(safeTerminalText(input)).toBe('BOLDhidden');
  });

  it('preserves carriage return (0x0D)', () => {
    expect(safeTerminalText('line1\r\nline2')).toBe('line1\r\nline2');
  });

  it('handles empty string input', () => {
    expect(safeTerminalText('')).toBe('');
  });

  it('strips title-setting OSC sequences', () => {
    expect(safeTerminalText('\u001b]0;evil-title\u0007safe')).toBe('safe');
  });
});
