import { describe, expect, test, vi } from 'vitest';
import { ExitError, mockExitThrow, setNonInteractive } from '../helpers';

describe('parseCsv', () => {
  let exitSpy: ReturnType<typeof mockExitThrow> | undefined;
  let errorSpy: ReturnType<typeof vi.spyOn> | undefined;

  function setup() {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();
  }

  function teardown() {
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  }

  const globalOpts = { json: true };

  test('parses basic CSV with headers', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv(
      'name,email\nAlice,alice@example.com\nBob,bob@example.com',
      globalOpts,
    );
    expect(rows).toEqual([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ]);
  });

  test('handles quoted fields with commas', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv(
      'name,description\nAlice,"Has a, comma"\nBob,Simple',
      globalOpts,
    );
    expect(rows[0].description).toBe('Has a, comma');
    expect(rows[1].description).toBe('Simple');
  });

  test('handles escaped quotes in quoted fields', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv(
      'name,quote\nAlice,"She said ""hello"""\nBob,normal',
      globalOpts,
    );
    expect(rows[0].quote).toBe('She said "hello"');
  });

  test('handles CRLF line endings', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv('a,b\r\n1,2\r\n3,4', globalOpts);
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  test('skips blank lines', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv('a,b\n1,2\n\n3,4\n', globalOpts);
    expect(rows).toHaveLength(2);
  });

  test('trims whitespace from unquoted headers and values', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv(
      ' name , email \n Alice , alice@example.com ',
      globalOpts,
    );
    expect(rows[0]).toEqual({ name: 'Alice', email: 'alice@example.com' });
  });

  test('preserves whitespace in quoted values', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv('name,value\nAlice," spaced "', globalOpts);
    expect(rows[0].value).toBe(' spaced ');
  });

  test('handles missing trailing columns (fewer fields than headers)', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv('a,b,c\n1,2\n4,5,6', globalOpts);
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
    expect(rows[1]).toEqual({ a: '4', b: '5', c: '6' });
  });

  test('errors on rows with more fields than headers', async () => {
    setup();
    try {
      const { parseCsv } = await import('../../src/lib/csv');
      let threw = false;
      try {
        parseCsv('a,b\n1,2,3', globalOpts);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(ExitError);
        expect((err as ExitError).code).toBe(1);
      }
      expect(threw).toBe(true);
      const output = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('invalid_csv');
    } finally {
      teardown();
    }
  });

  test('errors on header-only CSV with invalid_csv code', async () => {
    setup();
    try {
      const { parseCsv } = await import('../../src/lib/csv');
      let threw = false;
      try {
        parseCsv('name,email', globalOpts);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(ExitError);
        expect((err as ExitError).code).toBe(1);
      }
      expect(threw).toBe(true);
      const output = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('invalid_csv');
    } finally {
      teardown();
    }
  });

  test('errors on empty CSV with invalid_csv code', async () => {
    setup();
    try {
      const { parseCsv } = await import('../../src/lib/csv');
      let threw = false;
      try {
        parseCsv('', globalOpts);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(ExitError);
        expect((err as ExitError).code).toBe(1);
      }
      expect(threw).toBe(true);
      const output = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('invalid_csv');
    } finally {
      teardown();
    }
  });

  test('errors on duplicate headers with invalid_csv code', async () => {
    setup();
    try {
      const { parseCsv } = await import('../../src/lib/csv');
      let threw = false;
      try {
        parseCsv('name,name\nAlice,Bob', globalOpts);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(ExitError);
        expect((err as ExitError).code).toBe(1);
      }
      expect(threw).toBe(true);
      const output = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
      expect(output).toContain('invalid_csv');
    } finally {
      teardown();
    }
  });

  test('handles quoted fields spanning multiple lines', async () => {
    const { parseCsv } = await import('../../src/lib/csv');
    const rows = parseCsv(
      'name,bio\nAlice,"Line 1\nLine 2"\nBob,Simple',
      globalOpts,
    );
    expect(rows[0].bio).toBe('Line 1\nLine 2');
    expect(rows[1].bio).toBe('Simple');
  });
});
