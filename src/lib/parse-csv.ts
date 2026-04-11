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

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < content.length) {
    const c = content[i];
    if (c === undefined) {
      break;
    }

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
        i++;
        break;
      case ',':
        pushField();
        i++;
        break;
      case '\r':
        i++;
        break;
      case '\n':
        pushField();
        pushRow();
        i++;
        break;
      default:
        field += c;
        i++;
    }
  }

  pushField();
  if (row.length > 0 && row.some((cell) => cell.trim() !== '')) {
    pushRow();
  }

  return rows;
}
