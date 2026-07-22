import { describe, expect, it } from 'vitest';
import {
  parseAttachmentSpec,
  parseAttachmentsJson,
} from '../../src/lib/attachments';

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
