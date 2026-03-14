import type { GlobalOpts } from './client';
import { outputError } from './output';

/**
 * Minimal RFC 4180-compliant CSV parser.
 *
 * Handles quoted fields (including escaped quotes ""), CRLF/LF line endings,
 * and multi-line quoted values. Unquoted field values are trimmed; quoted
 * values are preserved verbatim (per RFC 4180). Returns an array of objects
 * keyed by the header row. No external dependencies.
 */
export function parseCsv(
  raw: string,
  globalOpts: GlobalOpts,
): Array<Record<string, string>> {
  const lines = splitCsvLines(raw);

  if (lines.length < 2) {
    outputError(
      {
        message: 'CSV must contain at least a header row and one data row.',
        code: 'invalid_csv',
      },
      { json: globalOpts.json },
    );
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === '')) {
    outputError(
      { message: 'CSV header row is empty.', code: 'invalid_csv' },
      { json: globalOpts.json },
    );
  }

  const duplicates = headers.filter(
    (h, i) => h !== '' && headers.indexOf(h) !== i,
  );
  if (duplicates.length > 0) {
    outputError(
      {
        message: `Duplicate CSV headers: ${[...new Set(duplicates)].join(', ')}`,
        code: 'invalid_csv',
      },
      { json: globalOpts.json },
    );
  }

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      continue; // skip blank lines
    }
    const values = parseCsvLine(line);
    if (values.length > headers.length) {
      outputError(
        {
          message: `CSV row ${i + 1} has ${values.length} fields but the header has ${headers.length}. Fix the row or adjust the header.`,
          code: 'invalid_csv',
        },
        { json: globalOpts.json },
      );
    }
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    outputError(
      { message: 'CSV contains no data rows.', code: 'invalid_csv' },
      { json: globalOpts.json },
    );
  }

  return rows;
}

/**
 * Split CSV content into logical lines, respecting quoted fields that
 * may span multiple physical lines.
 */
function splitCsvLines(raw: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      lines.push(current);
      current = '';
      // Handle \r\n
      if (ch === '\r' && raw[i + 1] === '\n') {
        i++;
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

/**
 * Parse a single CSV line into an array of field values.
 * Handles quoted fields with escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  let expectField = true;

  while (i < line.length) {
    expectField = false;

    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            value += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma after quoted field
      if (i < line.length && line[i] === ',') {
        i++;
        expectField = true;
      }
    } else {
      // Unquoted field — trim whitespace per common convention
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.slice(i).trim());
        break;
      }
      fields.push(line.slice(i, commaIdx).trim());
      i = commaIdx + 1;
      expectField = true;
    }
  }

  // Trailing comma means there's an empty final field
  if (expectField) {
    fields.push('');
  }

  return fields;
}
