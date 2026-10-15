import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  parseAttachmentSpec,
  parseAttachmentsJson,
  resolveDraftAttachments,
} from '../../src/lib/attachments';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
} from '../helpers';

describe('parseAttachmentSpec', () => {
  it('parses a bare path with no params', () => {
    expect(parseAttachmentSpec('./report.pdf')).toEqual({
      source: './report.pdf',
      isUrl: false,
    });
  });

  it('parses cid, type, and filename params', () => {
    expect(
      parseAttachmentSpec('./logo.png;cid=logo;type=image/png;filename=l.png'),
    ).toEqual({
      source: './logo.png',
      isUrl: false,
      contentId: 'logo',
      contentType: 'image/png',
      filename: 'l.png',
    });
  });

  it('detects http and https URLs', () => {
    expect(parseAttachmentSpec('https://example.com/a.pdf;cid=doc')).toEqual({
      source: 'https://example.com/a.pdf',
      isUrl: true,
      contentId: 'doc',
    });
    expect(parseAttachmentSpec('HTTP://example.com/a.pdf').isUrl).toBe(true);
  });

  it('keeps MIME parameters inside the type value', () => {
    expect(
      parseAttachmentSpec('./a.txt;type=text/plain;charset=utf-8').contentType,
    ).toBe('text/plain;charset=utf-8');
  });

  it('accepts Windows paths and paths with plain semicolons or equals', () => {
    expect(parseAttachmentSpec('C:\\Users\\me\\logo.png;cid=logo').source).toBe(
      'C:\\Users\\me\\logo.png',
    );
    expect(parseAttachmentSpec('./odd;name.txt').source).toBe('./odd;name.txt');
    expect(parseAttachmentSpec('./key=value.txt').source).toBe(
      './key=value.txt',
    );
  });

  it('rejects unrecognized ;key= params in the source', () => {
    expect(() => parseAttachmentSpec('./a.png;content-id=logo')).toThrow(
      /Unrecognized attachment parameter/,
    );
  });

  it('rejects unrecognized ;key= params inside cid and filename values', () => {
    expect(() => parseAttachmentSpec('./a.png;cid=logo;foo=bar')).toThrow(
      /Unrecognized attachment parameter/,
    );
    expect(() => parseAttachmentSpec('./a.png;filename=a;foo=bar')).toThrow(
      /Unrecognized attachment parameter/,
    );
  });

  it('rejects duplicate params', () => {
    expect(() => parseAttachmentSpec('./a.png;cid=a;cid=b')).toThrow(
      /Duplicate ";cid="/,
    );
  });

  it('rejects empty param values and empty source', () => {
    expect(() => parseAttachmentSpec('./a.png;cid=')).toThrow(/Empty ";cid="/);
    expect(() => parseAttachmentSpec(';cid=logo')).toThrow(
      /Missing file path or URL/,
    );
  });
});

describe('parseAttachmentsJson', () => {
  it('parses an array of attachment objects', () => {
    expect(
      parseAttachmentsJson(
        '[{"path":"https://example.com/a.pdf","contentId":"doc"}]',
      ),
    ).toEqual([{ path: 'https://example.com/a.pdf', contentId: 'doc' }]);
  });

  it('aliases snake_case fields to camelCase', () => {
    expect(
      parseAttachmentsJson(
        '[{"content":"aGk=","filename":"a.png","content_type":"image/png","content_id":"logo"}]',
      ),
    ).toEqual([
      {
        content: 'aGk=',
        filename: 'a.png',
        contentType: 'image/png',
        contentId: 'logo',
      },
    ]);
  });

  it('rejects invalid JSON, non-arrays, and non-object items', () => {
    expect(() => parseAttachmentsJson('not json')).toThrow(/not valid JSON/);
    expect(() => parseAttachmentsJson('{"path":"x"}')).toThrow(
      /must contain a JSON array/,
    );
    expect(() => parseAttachmentsJson('["x"]')).toThrow(
      /index 0 must be a JSON object/,
    );
  });

  it('rejects unsupported fields and non-string values', () => {
    expect(() => parseAttachmentsJson('[{"path":"x","size":1}]')).toThrow(
      /unsupported field "size"/,
    );
    expect(() => parseAttachmentsJson('[{"path":1}]')).toThrow(
      /"path" must be a string/,
    );
  });

  it('rejects setting a field via both snake_case and camelCase', () => {
    expect(() =>
      parseAttachmentsJson('[{"path":"x","content_id":"a","contentId":"b"}]'),
    ).toThrow(/more than once/);
  });

  it('rejects attachments without content or path', () => {
    expect(() => parseAttachmentsJson('[{"filename":"a.png"}]')).toThrow(
      /must include "content"/,
    );
  });
});

describe('resolveDraftAttachments', () => {
  const restoreEnv = captureTestEnv();
  let dir: string;
  let notesPath: string;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'resend-draft-attachments-'));
    notesPath = join(dir, 'notes.txt');
    writeFileSync(notesPath, 'hello');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  const writeJson = (name: string, value: unknown) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(value));
    return path;
  };

  const expectRejection = async (
    specs: string[] | undefined,
    attachmentsFile: string | undefined,
    problem: string,
  ) => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(async () =>
      resolveDraftAttachments(specs, attachmentsFile, {}),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_attachment');
    expect(output).toContain(problem);
  };

  it('returns undefined without attachments', () => {
    expect(resolveDraftAttachments(undefined, undefined, {})).toBeUndefined();
  });

  it('returns content, filename and contentType for a local file', () => {
    expect(
      resolveDraftAttachments(
        [`${notesPath};type=text/plain;filename=n.txt`],
        undefined,
        {},
      ),
    ).toStrictEqual([
      {
        content: Buffer.from('hello'),
        filename: 'n.txt',
        contentType: 'text/plain',
      },
    ]);
  });

  it('rejects a URL', async () => {
    await expectRejection(
      ['https://example.com/a.pdf;type=application/pdf'],
      undefined,
      'needs file content',
    );
  });

  it('rejects a path entry in the attachments file', async () => {
    const file = writeJson('path.json', [
      {
        path: 'https://example.com/a.pdf',
        filename: 'a.pdf',
        content_type: 'application/pdf',
      },
    ]);
    await expectRejection(undefined, file, 'needs file content');
  });

  it('rejects a content ID', async () => {
    await expectRejection(
      [`${notesPath};type=text/plain;cid=logo`],
      undefined,
      'does not take a content ID',
    );
  });

  it('rejects a file without a MIME type', async () => {
    await expectRejection([notesPath], undefined, 'needs a MIME type');
  });

  it('rejects an attachments file entry without a filename', async () => {
    const file = writeJson('no-filename.json', [
      { content: 'aGVsbG8=', content_type: 'text/plain' },
    ]);
    await expectRejection(undefined, file, 'needs a filename');
  });
});
