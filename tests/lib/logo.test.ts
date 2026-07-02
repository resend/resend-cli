import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { printBanner } from '../../src/lib/logo';

describe('printBanner', () => {
  let writeSpy: MockInstance;

  afterEach(() => {
    writeSpy?.mockRestore();
  });

  it('writes ASCII logo and tagline to stdout', () => {
    const chunks: string[] = [];
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        chunks.push(
          typeof chunk === 'string'
            ? chunk
            : new TextDecoder().decode(chunk as Uint8Array),
        );
        return true;
      });

    printBanner();

    const out = chunks.join('');
    expect(out).toContain('+++++');
    expect(out).toContain('Email for developers');
  });
});
