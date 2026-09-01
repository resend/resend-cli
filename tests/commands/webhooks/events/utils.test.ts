import { describe, expect, it } from 'vitest';
import { renderWebhookEventAttemptsTable } from '../../../../src/commands/webhooks/events/utils';

describe('renderWebhookEventAttemptsTable', () => {
  it('keeps a multi-line endpoint response on one row', () => {
    const table = renderWebhookEventAttemptsTable([
      {
        id: 'atmpt_2ZbUCwvGmIT4mLIN6d3Yz0Ainbd',
        http_status_code: 500,
        response:
          '<html>\n  <body>\n    Internal Server Error\n  </body>\n</html>',
        sent_at: '2026-08-22T15:28:05.000Z',
      },
    ]);

    const rows = table
      .split('\n')
      .filter((line) => line.includes('atmpt_2ZbUCwvGmIT4mLIN6d3Yz0Ainbd'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('<html> <body> Internal Server Error');

    const widths = new Set(table.split('\n').map((line) => line.length));
    expect(widths.size).toBe(1);
  });
});
