import { afterEach, describe, expect, it } from 'vitest';
import { renderTable } from '../../src/lib/table';

describe('renderTable', () => {
  it('renders a table with correct border characters', () => {
    const output = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    expect(output).toContain('┌');
    expect(output).toContain('┐');
    expect(output).toContain('└');
    expect(output).toContain('┘');
    expect(output).toContain('│');
  });

  it('includes headers in output', () => {
    const output = renderTable(
      ['Name', 'Status'],
      [['my-domain.com', 'verified']],
    );
    expect(output).toContain('Name');
    expect(output).toContain('Status');
  });

  it('includes row data in output', () => {
    const output = renderTable(
      ['Name', 'Status'],
      [['my-domain.com', 'verified']],
    );
    expect(output).toContain('my-domain.com');
    expect(output).toContain('verified');
  });

  it('pads columns to the widest cell in each column', () => {
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

  it('renders multiple rows', () => {
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

  it('contains a separator row between header and data', () => {
    const output = renderTable(['Col'], [['val']]);
    expect(output).toContain('├');
    expect(output).toContain('┤');
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

  it('renders table at full width when terminal width is undefined', () => {
    setTerminalWidth(undefined);
    const output = renderTable(
      ['Name', 'ID'],
      [['a-very-long-domain-name.example.com', 'abc-123-def-456']],
    );
    expect(output).toContain('│');
    expect(output).toContain('a-very-long-domain-name.example.com');
    expect(output).toContain('abc-123-def-456');
  });

  it('renders table when it fits within terminal width', () => {
    setTerminalWidth(undefined);
    const output = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    const lineWidth = output.split('\n')[0].length;

    setTerminalWidth(lineWidth + 10);
    const output2 = renderTable(['Name', 'ID'], [['Alice', 'abc-123']]);
    expect(output2).toContain('│');
    expect(output2).toBe(output);
  });

  it('switches to cards when table overflows terminal', () => {
    setTerminalWidth(30);
    const output = renderTable(
      ['Name', 'ID'],
      [['a-very-long-domain-name.example.com', 'abc-123']],
    );
    expect(output).not.toContain('│');
    expect(output).toContain('a-very-long-domain-name.example.com');
    expect(output).toContain('abc-123');
  });

  it('cards include all values untruncated', () => {
    setTerminalWidth(30);
    const output = renderTable(
      ['Name', 'Description', 'ID'],
      [['my-widget', 'A very long description of the widget', 'abc-123']],
    );
    expect(output).toContain('A very long description of the widget');
    expect(output).toContain('abc-123');
    expect(output).toContain('my-widget');
  });

  it('cards separate rows with blank lines', () => {
    setTerminalWidth(30);
    const output = renderTable(
      ['Name', 'Description', 'ID'],
      [
        ['widget-a', 'First widget description', 'id-111'],
        ['widget-b', 'Second widget description', 'id-222'],
      ],
    );
    const cards = output.split('\n\n');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('widget-a');
    expect(cards[1]).toContain('widget-b');
  });

  it('cards use box-drawing separator with row number', () => {
    setTerminalWidth(20);
    const output = renderTable(
      ['Name', 'ID'],
      [
        ['test', 'abc-123-def-456-ghi-789-jkl-012-mno'],
        ['test2', 'xyz-789-uvw-456-rst-123-opq-000-aaa'],
      ],
    );
    expect(output).toContain('── 1 ─');
    expect(output).toContain('── 2 ─');
  });

  it('wide table with many columns switches to cards', () => {
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
    );
    expect(output).not.toContain('│');
    expect(output).toContain('sender@example.com');
    expect(output).toContain('dca22e90-1693-4b98-a531-ebb9aaf69a2d');
  });
});
