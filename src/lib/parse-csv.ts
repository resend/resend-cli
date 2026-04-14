/**
 * Parse CSV into rows of string fields (comma delimiter, RFC 4180 quoting:
 * fields may be wrapped in `"`, and `"` inside a field is escaped as `""`).
 */
export function parseCsvTable(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  let hasContent = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
    hasContent = false;
  };

  while (i < content.length) {
    const c = content[i];

    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
      continue;
    }

    switch (c) {
      case '"':
        inQuotes = true;
        hasContent = true;
        i++;
        break;
      case ',':
        pushField();
        hasContent = true;
        i++;
        break;
      case '\r':
        i++;
        break;
      case '\n':
        pushField();
        if (hasContent || row.length > 1) {
          pushRow();
        } else if (row.length === 1) {
          row = [];
        }
        i++;
        break;
      default:
        field += c;
        hasContent = true;
        i++;
    }
  }

  pushField();
  if (hasContent || row.length > 1 || (row.length === 1 && row[0] !== '')) {
    pushRow();
  }

  return rows;
}
