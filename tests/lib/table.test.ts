import { describe, expect, test } from 'vitest';
import { renderTable } from '../../src/lib/formatters';

describe('renderTable', () => {
  test('renders a table with correct border characters', () => {
    const output = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    expect(output).toContain('┌');
    expect(output).toContain('┐');
    expect(output).toContain('└');
    expect(output).toContain('┘');
    expect(output).toContain('│');
  });

  test('includes headers in output', () => {
    const output = renderTable(
      ['Name', 'Status'],
      [['my-domain.com', 'verified']],
    );
    expect(output).toContain('Name');
    expect(output).toContain('Status');
  });

  test('includes row data in output', () => {
    const output = renderTable(
      ['Name', 'Status'],
      [['my-domain.com', 'verified']],
    );
    expect(output).toContain('my-domain.com');
    expect(output).toContain('verified');
  });

  test('pads columns to the widest cell in each column', () => {
    const output = renderTable(
      ['Key', 'Value'],
      [
        ['short', 'a very long value here'],
        ['much longer key', 'v'],
      ],
    );
    // All rows should have the same line length
    const lines = output.split('\n');
    const lengths = lines.map((l) => l.length);
    expect(new Set(lengths).size).toBe(1);
  });

  test('renders multiple rows', () => {
    const output = renderTable(
      ['A', 'B'],
      [
        ['row1a', 'row1b'],
        ['row2a', 'row2b'],
      ],
    );
    expect(output).toContain('row1a');
    expect(output).toContain('row2a');
  });

  test('contains a separator row between header and data', () => {
    const output = renderTable(['Col'], [['val']]);
    expect(output).toContain('├');
    expect(output).toContain('┤');
  });
});
