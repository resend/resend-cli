import { describe, expect, it, vi } from 'vitest';
import { apiKeyPickerConfig } from '../../../src/commands/api-keys/utils';

describe('apiKeyPickerConfig', () => {
  it('forwards limit and after to resend.apiKeys.list', async () => {
    const mockList = vi.fn(async () => ({
      data: {
        data: [{ id: 'key-1', name: 'Key One' }],
        has_more: true,
      },
      error: null,
    }));
    const resend = { apiKeys: { list: mockList } } as never;

    const result = await apiKeyPickerConfig.fetchItems(resend, {
      limit: 20,
      after: 'cursor-abc',
    });

    expect(mockList).toHaveBeenCalledWith({
      limit: 20,
      after: 'cursor-abc',
    });
    expect(result.data?.has_more).toBe(true);
  });

  it('omits after when not provided', async () => {
    const mockList = vi.fn(async () => ({
      data: {
        data: [{ id: 'key-1', name: 'Key One' }],
        has_more: false,
      },
      error: null,
    }));
    const resend = { apiKeys: { list: mockList } } as never;

    await apiKeyPickerConfig.fetchItems(resend, { limit: 20 });

    expect(mockList).toHaveBeenCalledWith({ limit: 20 });
  });

  it('preserves has_more from the SDK response', async () => {
    const mockList = vi.fn(async () => ({
      data: {
        data: [{ id: 'key-1', name: 'Key One' }],
        has_more: true,
      },
      error: null,
    }));
    const resend = { apiKeys: { list: mockList } } as never;

    const result = await apiKeyPickerConfig.fetchItems(resend, { limit: 20 });

    expect(result.data?.has_more).toBe(true);
  });

  it('displays name as label and id as hint', () => {
    const item = { id: 'key-123', name: 'My API Key' };
    const display = apiKeyPickerConfig.display(item);

    expect(display).toEqual({ label: 'My API Key', hint: 'key-123' });
  });
});
