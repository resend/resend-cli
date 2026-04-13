import { describe, expect, it } from 'vitest';
import {
  deepSanitize,
  safeTerminalText,
} from '../../src/lib/safe-terminal-text';

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

  it('preserves CRLF but strips bare carriage return', () => {
    expect(safeTerminalText('line1\r\nline2')).toBe('line1\r\nline2');
    expect(safeTerminalText('safe\roverwrite')).toBe('safeoverwrite');
  });

  it('handles empty string input', () => {
    expect(safeTerminalText('')).toBe('');
  });

  it('strips title-setting OSC sequences', () => {
    expect(safeTerminalText('\u001b]0;evil-title\u0007safe')).toBe('safe');
  });
});

describe('deepSanitize', () => {
  it('sanitizes all string values in a flat object', () => {
    const input = { name: '\u001b[31mred\u001b[0m', id: 'abc' };
    expect(deepSanitize(input)).toEqual({ name: 'red', id: 'abc' });
  });

  it('sanitizes nested objects', () => {
    const input = { data: { from: '\u001b[1mbold\u001b[0m' } };
    expect(deepSanitize(input)).toEqual({ data: { from: 'bold' } });
  });

  it('sanitizes arrays of strings', () => {
    const input = { to: ['\u001b[31ma\u001b[0m', 'b'] };
    expect(deepSanitize(input)).toEqual({ to: ['a', 'b'] });
  });

  it('passes through numbers, booleans, and null', () => {
    const input = { count: 42, active: true, meta: null };
    expect(deepSanitize(input)).toEqual({
      count: 42,
      active: true,
      meta: null,
    });
  });

  it('handles a realistic API response', () => {
    const input = {
      id: 'abc-123',
      from: '\u001b]8;;https://evil.example\u0007click\u001b]8;;\u0007',
      to: ['user@example.com'],
      subject: 'Hello\x00World',
      created_at: '2025-01-01',
    };
    expect(deepSanitize(input)).toEqual({
      id: 'abc-123',
      from: 'click',
      to: ['user@example.com'],
      subject: 'HelloWorld',
      created_at: '2025-01-01',
    });
  });
});
