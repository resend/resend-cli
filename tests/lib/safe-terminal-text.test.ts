import { describe, expect, it } from 'vitest';
import { safeTerminalText } from '../../src/lib/safe-terminal-text';

describe('safeTerminalText', () => {
  it('returns plain text unchanged', () => {
    expect(safeTerminalText('hello world')).toBe('hello world');
  });

  it('preserves newlines and tabs', () => {
    expect(safeTerminalText('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('escapes ANSI escape sequences', () => {
    expect(safeTerminalText('\u001b[2Jspoofed')).toBe('\\u001b[2Jspoofed');
  });

  it('escapes CSI cursor movement sequences', () => {
    expect(safeTerminalText('\u001b[Hspoofed')).toBe('\\u001b[Hspoofed');
  });

  it('escapes null bytes', () => {
    expect(safeTerminalText('before\u0000after')).toBe('before\\u0000after');
  });

  it('escapes C1 control characters', () => {
    expect(safeTerminalText('a\u008db')).toBe('a\\u008db');
  });

  it('escapes DEL character', () => {
    expect(safeTerminalText('a\u007fb')).toBe('a\\u007fb');
  });

  it('escapes multiple control characters in one string', () => {
    expect(safeTerminalText('\u001b[31mred\u001b[0m')).toBe(
      '\\u001b[31mred\\u001b[0m',
    );
  });

  it('does not escape carriage return', () => {
    expect(safeTerminalText('line\r\n')).toBe('line\r\n');
  });

  it('handles empty strings', () => {
    expect(safeTerminalText('')).toBe('');
  });

  it('escapes OSC 52 clipboard payloads', () => {
    const osc52 = '\u001b]52;c;SGVsbG8=\u0007';
    const result = safeTerminalText(osc52);
    expect(result).not.toContain('\u001b');
    expect(result).not.toContain('\u0007');
  });

  it('preserves unicode text beyond control range', () => {
    expect(safeTerminalText('héllo wörld 日本語')).toBe('héllo wörld 日本語');
  });
});
