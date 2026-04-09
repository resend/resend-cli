import { describe, expect, it } from 'vitest';
import { shQuote } from '../../src/lib/sh-quote';

describe('shQuote', () => {
  it('wraps a plain string in single quotes', () => {
    expect(shQuote('hello')).toBe("'hello'");
  });

  it('escapes embedded single quotes', () => {
    expect(shQuote("it's")).toBe("'it'\\''s'");
  });

  it('neutralises semicolons and pipes', () => {
    expect(shQuote('a; rm -rf /')).toBe("'a; rm -rf /'");
  });

  it('neutralises subshell syntax', () => {
    expect(shQuote('$(whoami)')).toBe("'$(whoami)'");
  });

  it('handles empty string', () => {
    expect(shQuote('')).toBe("''");
  });

  it('handles backticks', () => {
    expect(shQuote('`id`')).toBe("'`id`'");
  });

  it('handles multiple single quotes', () => {
    expect(shQuote("a'b'c")).toBe("'a'\\''b'\\''c'");
  });
});
