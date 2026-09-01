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

    expect(table).toContain(
      '<html> <body> Internal Server Error </body> </html>',
    );
  });
});
