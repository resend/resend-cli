import { afterEach, describe, expect, test } from 'vitest';
import { renderTable } from '../../src/lib/table';

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

describe('renderTable terminal-width truncation', () => {
  const originalColumns = process.stdout.columns;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  function setTerminalWidth(width: number | undefined) {
    Object.defineProperty(process.stdout, 'columns', {
      value: width,
      writable: true,
      configurable: true,
    });
  }

  test('no truncation when terminal width is undefined', () => {
    setTerminalWidth(undefined);
    const output = renderTable(
      ['Name', 'ID'],
      [['a-very-long-domain-name.example.com', 'abc-123-def-456']],
    );
    expect(output).toContain('a-very-long-domain-name.example.com');
    expect(output).toContain('abc-123-def-456');
  });

  test('no truncation when table fits within terminal width', () => {
    setTerminalWidth(undefined);
    const output = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    const lineWidth = output.split('\n')[0].length;

    setTerminalWidth(lineWidth + 10);
    const output2 = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    expect(output2).toContain('Alice');
    expect(output2).toContain('abc-123');
    expect(output2).toBe(output);
  });

  test('truncates with ... when table overflows — fixed column intact', () => {
    setTerminalWidth(35);
    const output = renderTable(
      ['Name', 'ID'],
      [['a-very-long-domain-name.example.com', 'abc-123']],
      '(no results)',
      [{}, { fixed: true }],
    );
    expect(output).toContain('abc-123');
    expect(output).not.toContain('a-very-long-domain-name.example.com');
    expect(output).toContain('...');
  });

  test('proportional distribution — wider shrinkable column loses more', () => {
    setTerminalWidth(55);
    const output = renderTable(
      ['A', 'B', 'C'],
      [
        [
          'short-val',
          'a-medium-length-value',
          'a-very-very-very-long-value-here',
        ],
      ],
      '(no results)',
      [{ fixed: true }, {}, {}],
    );
    const lines = output.split('\n');
    const dataLine = lines[3];
    const cells = dataLine
      .split('│')
      .slice(1, -1)
      .map((c) => c.trim());
    expect(cells[0]).toBe('short-val');
    expect(cells[2]).toContain('...');
  });

  test('minimum width — shrinkable column never goes below header length', () => {
    setTerminalWidth(30);
    const output = renderTable(
      ['Name', 'ID'],
      [['a-very-long-domain-name.example.com', 'abc-123-def-456-ghi-789']],
      '(no results)',
      [{}, { fixed: true }],
    );
    const lines = output.split('\n');
    const headerLine = lines[1];
    expect(headerLine).toContain('Name');
  });
});

describe('renderTable card layout fallback', () => {
  const originalColumns = process.stdout.columns;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      writable: true,
      configurable: true,
    });
  });

  function setTerminalWidth(width: number | undefined) {
    Object.defineProperty(process.stdout, 'columns', {
      value: width,
      writable: true,
      configurable: true,
    });
  }

  test('switches to cards when columns would be too narrow', () => {
    setTerminalWidth(60);
    const output = renderTable(
      ['From', 'To', 'Subject', 'Status', 'Created', 'ID'],
      [
        [
          'sender@example.com',
          'recipient@example.com',
          'Hello world',
          'delivered',
          '2026-01-15',
          'dca22e90-1693-4b98-a531-ebb9aaf69a2d',
        ],
      ],
      '(no emails)',
      [{}, {}, {}, {}, {}, { fixed: true }],
    );
    expect(output).not.toContain('│');
    expect(output).toContain('From');
    expect(output).toContain('sender@example.com');
    expect(output).toContain('dca22e90-1693-4b98-a531-ebb9aaf69a2d');
  });

  test('card layout includes all values untruncated', () => {
    setTerminalWidth(50);
    const output = renderTable(
      ['Name', 'Description', 'ID'],
      [['my-widget', 'A very long description of the widget', 'abc-123']],
      '(none)',
      [{}, {}, { fixed: true }],
    );
    expect(output).toContain('A very long description of the widget');
    expect(output).toContain('abc-123');
    expect(output).toContain('my-widget');
  });

  test('card layout separates rows with blank lines', () => {
    setTerminalWidth(40);
    const output = renderTable(
      ['Name', 'Description', 'ID'],
      [
        ['widget-a', 'First widget description', 'id-111'],
        ['widget-b', 'Second widget description', 'id-222'],
      ],
      '(none)',
      [{}, {}, { fixed: true }],
    );
    const cards = output.split('\n\n');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('widget-a');
    expect(cards[1]).toContain('widget-b');
  });

  test('card layout uses box-drawing separator with row number', () => {
    setTerminalWidth(40);
    const output = renderTable(
      ['Name', 'ID'],
      [
        ['test', 'abc-123-def-456-ghi-789-jkl-012-mno'],
        ['test2', 'xyz-789-uvw-456-rst-123-opq-000-aaa'],
      ],
      '(none)',
      [{}, { fixed: true }],
    );
    expect(output).toContain('── 1 ─');
    expect(output).toContain('── 2 ─');
  });

  test('no card layout when terminal width is undefined', () => {
    setTerminalWidth(undefined);
    const output = renderTable(
      ['From', 'To', 'Subject', 'Status', 'Created', 'ID'],
      [
        [
          'sender@example.com',
          'recipient@example.com',
          'Hello world',
          'delivered',
          '2026-01-15',
          'dca22e90-1693-4b98-a531-ebb9aaf69a2d',
        ],
      ],
      '(no emails)',
      [{}, {}, {}, {}, {}, { fixed: true }],
    );
    expect(output).toContain('│');
    expect(output).toContain('┌');
  });

  test('stays in table mode when columns fit after truncation', () => {
    setTerminalWidth(undefined);
    const natural = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    const lineWidth = natural.split('\n')[0].length;

    setTerminalWidth(lineWidth);
    const output = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    expect(output).toContain('│');
    expect(output).toContain('Alice');
  });

  test('extreme narrowness — renders cards, not a broken table', () => {
    setTerminalWidth(10);
    const output = renderTable(
      ['Name', 'Description', 'ID'],
      [['test', 'a long description here', 'abc-123']],
      '(no results)',
      [{}, {}, { fixed: true }],
    );
    expect(output).not.toContain('│');
    expect(output).toContain('Name');
    expect(output).toContain('test');
    expect(output).toContain('a long description here');
    expect(output).toContain('abc-123');
  });
});
