import {
  afterEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { printBannerPlain } from '../../src/lib/logo';

describe('printBannerPlain', () => {
  let writeSpy: MockInstance;

  afterEach(() => {
    writeSpy?.mockRestore();
  });

  test('writes ASCII logo to stdout', () => {
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

    printBannerPlain();

    const out = chunks.join('');
    expect(out).toContain('██████╗');
    expect(out).toContain('█');
  });
});
