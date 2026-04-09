import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { parseReactEmailProps } from '../../src/lib/parse-react-email-props';
import { ExitError, mockExitThrow, setNonInteractive } from '../helpers';

describe('parseReactEmailProps', () => {
  const globalOpts = { json: false } as Parameters<
    typeof parseReactEmailProps
  >[2];
  let exitSpy: MockInstance | undefined;
  let logSpy: MockInstance | undefined;

  beforeEach(() => {
    setNonInteractive();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();
  });

  afterEach(() => {
    exitSpy?.mockRestore();
    logSpy?.mockRestore();
    exitSpy = undefined;
    logSpy = undefined;
  });

  it('returns empty object when both args are undefined', () => {
    const result = parseReactEmailProps(undefined, undefined, globalOpts);
    expect(result).toEqual({});
  });

  it('parses inline JSON string', () => {
    const result = parseReactEmailProps(
      '{"name":"John","count":42}',
      undefined,
      globalOpts,
    );
    expect(result).toEqual({ name: 'John', count: 42 });
  });

  it('parses nested JSON objects', () => {
    const result = parseReactEmailProps(
      '{"user":{"name":"Alice","age":30},"items":["a","b"]}',
      undefined,
      globalOpts,
    );
    expect(result).toEqual({
      user: { name: 'Alice', age: 30 },
      items: ['a', 'b'],
    });
  });

  it('reads and parses JSON from a file', () => {
    const tmpFile = join(
      tmpdir(),
      `resend-test-props-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    writeFileSync(tmpFile, '{"greeting":"Hello","year":2026}');

    const result = parseReactEmailProps(undefined, tmpFile, globalOpts);
    expect(result).toEqual({ greeting: 'Hello', year: 2026 });

    const { unlinkSync } = require('node:fs');
    try {
      unlinkSync(tmpFile);
    } catch {}
  });

  it('exits with invalid_options when both propsJson and propsFile are given', async () => {
    const tmpFile = join(
      tmpdir(),
      `resend-test-props-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    writeFileSync(tmpFile, '{"key":"value"}');

    try {
      let threw = false;
      try {
        parseReactEmailProps('{"key":"value"}', tmpFile, globalOpts);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(ExitError);
      }
      expect(threw).toBe(true);
    } finally {
      const { unlinkSync } = require('node:fs');
      try {
        unlinkSync(tmpFile);
      } catch {}
    }
  });

  it('exits with invalid_options for invalid JSON string', () => {
    let threw = false;
    try {
      parseReactEmailProps('not-valid-json', undefined, globalOpts);
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);

    const output = logSpy?.mock.calls.map((c) => c[0]).join(' ') ?? '';
    expect(output).toContain('invalid_options');
  });

  it('exits with invalid_options when props JSON is an array', () => {
    let threw = false;
    try {
      parseReactEmailProps('[1,2,3]', undefined, globalOpts);
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);

    const output = logSpy?.mock.calls.map((c) => c[0]).join(' ') ?? '';
    expect(output).toContain('invalid_options');
  });

  it('exits with invalid_options when props JSON is null', () => {
    let threw = false;
    try {
      parseReactEmailProps('null', undefined, globalOpts);
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);
  });

  it('exits with file_read_error when props file does not exist', () => {
    let threw = false;
    try {
      parseReactEmailProps(
        undefined,
        '/tmp/nonexistent-props-file.json',
        globalOpts,
      );
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(ExitError);
    }
    expect(threw).toBe(true);

    const output = logSpy?.mock.calls.map((c) => c[0]).join(' ') ?? '';
    expect(output).toContain('file_read_error');
  });
});
