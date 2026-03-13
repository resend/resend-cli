import {
  afterEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { printWelcome } from '../../src/lib/logo';

describe('printWelcome', () => {
  let writeSpy: MockInstance;

  afterEach(() => {
    writeSpy?.mockRestore();
  });

  test('writes ASCII logo and tagline to stdout', () => {
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

    printWelcome('1.2.3');

    const out = chunks.join('');
    expect(out).toContain('██████╗');
    expect(out).toContain('█');
    expect(out).toContain('v1.2.3');
    expect(out).toContain('Power your emails with code');
  });

  test('includes command hints and try/login', () => {
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

    printWelcome('0.0.1');

    const out = chunks.join('');
    expect(out).toContain('resend --help');
    expect(out).toContain('resend login');
    expect(out).toContain('try:');
    expect(out).toContain('resend.com/docs');
  });
});
