import { describe, expect, it, vi } from 'vitest';
import {
  renderSuppressionsTable,
  suppressionPickerConfig,
} from '../../../src/commands/suppressions/utils';

describe('suppressionPickerConfig', () => {
  it('forwards limit and after to resend.suppressions.list', async () => {
    const mockList = vi.fn(async () => ({
      data: { data: [{ id: 'sup-1' }], has_more: true },
      error: null,
    }));
    const resend = { suppressions: { list: mockList } } as never;

    await suppressionPickerConfig.fetchItems(resend, {
      limit: 20,
      after: 'cursor-abc',
    });

    expect(mockList).toHaveBeenCalledWith({ limit: 20, after: 'cursor-abc' });
  });

  it('omits after when not provided', async () => {
    const mockList = vi.fn(async () => ({
      data: { data: [{ id: 'sup-1' }], has_more: false },
      error: null,
    }));
    const resend = { suppressions: { list: mockList } } as never;

    await suppressionPickerConfig.fetchItems(resend, { limit: 20 });

    expect(mockList).toHaveBeenCalledWith({ limit: 20 });
  });

  it('displays email as label and id as hint', () => {
    const display = suppressionPickerConfig.display({
      id: 'sup-123',
      email: 'spam@example.com',
      origin: 'manual',
      source_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
    });

    expect(display).toEqual({ label: 'spam@example.com', hint: 'sup-123' });
  });
});

describe('renderSuppressionsTable', () => {
  it('renders a header row and the entries', () => {
    const table = renderSuppressionsTable([
      {
        id: 'sup-1',
        email: 'spam@example.com',
        origin: 'bounce',
        source_id: 'evt-1',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(table).toContain('Email');
    expect(table).toContain('Origin');
    expect(table).toContain('spam@example.com');
    expect(table).toContain('bounce');
  });

  it('shows an empty-state message when there are no entries', () => {
    expect(renderSuppressionsTable([])).toContain('(no suppressions)');
  });
});
