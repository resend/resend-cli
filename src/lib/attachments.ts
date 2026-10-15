import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { Attachment, InboxDraftAttachmentOptions } from 'resend';
import type { GlobalOpts } from './client';
import { readFile } from './files';
import { outputError } from './output';

export interface AttachmentSpec {
  source: string;
  isUrl: boolean;
  filename?: string;
  contentType?: string;
  contentId?: string;
}

// Split only on recognized ";key=" tokens so paths and MIME parameters
// (e.g. "type=text/plain;charset=utf-8") containing ";" or "=" still parse.
const PARAM_SPLIT = /;(cid|type|filename)=/;
const PARAM_LIKE = /;[\w-]+=/;

const SPEC_FIELDS = {
  cid: 'contentId',
  type: 'contentType',
  filename: 'filename',
} as const;

export function parseAttachmentSpec(value: string): AttachmentSpec {
  const segments = value.split(PARAM_SPLIT);
  const source = segments[0];
  if (!source) {
    throw new Error(`Missing file path or URL in attachment "${value}".`);
  }
  if (PARAM_LIKE.test(source)) {
    throw new Error(
      `Unrecognized attachment parameter in "${value}". Supported: ;cid=, ;type=, ;filename= (use --attachments-file for paths containing ";key=").`,
    );
  }
  const spec: AttachmentSpec = {
    source,
    isUrl: /^https?:\/\//i.test(source),
  };
  for (let i = 1; i < segments.length; i += 2) {
    const key = segments[i] as keyof typeof SPEC_FIELDS;
    const paramValue = segments[i + 1];
    const field = SPEC_FIELDS[key];
    if (spec[field] !== undefined) {
      throw new Error(`Duplicate ";${key}=" in attachment "${value}".`);
    }
    if (!paramValue) {
      throw new Error(`Empty ";${key}=" in attachment "${value}".`);
    }
    // MIME parameters like "type=text/plain;charset=utf-8" are legitimate,
    // but a ";key=" inside a cid or filename value is a typo.
    if (field !== 'contentType' && PARAM_LIKE.test(paramValue)) {
      throw new Error(
        `Unrecognized attachment parameter in "${value}". Supported: ;cid=, ;type=, ;filename= (use --attachments-file for paths containing ";key=").`,
      );
    }
    spec[field] = paramValue;
  }
  return spec;
}

const FIELD_ALIASES: Record<string, string> = {
  content_type: 'contentType',
  content_id: 'contentId',
};

const ALLOWED_FIELDS = new Set([
  'content',
  'filename',
  'path',
  'contentType',
  'contentId',
]);

export function parseAttachmentsJson(raw: string): Attachment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Attachments file is not valid JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      'Attachments file must contain a JSON array of attachment objects.',
    );
  }
  return parsed.map((item, i) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Attachment at index ${i} must be a JSON object.`);
    }
    const attachment: Record<string, string> = {};
    for (const [rawKey, fieldValue] of Object.entries(item)) {
      const key = FIELD_ALIASES[rawKey] ?? rawKey;
      if (!ALLOWED_FIELDS.has(key)) {
        throw new Error(
          `Attachment at index ${i} has unsupported field "${rawKey}". Supported: content, filename, path, content_type/contentType, content_id/contentId.`,
        );
      }
      if (key in attachment) {
        throw new Error(
          `Attachment at index ${i} sets "${key}" more than once (snake_case and camelCase are aliases).`,
        );
      }
      if (typeof fieldValue !== 'string') {
        throw new Error(
          `Attachment at index ${i}: "${rawKey}" must be a string.`,
        );
      }
      attachment[key] = fieldValue;
    }
    if (!attachment.content && !attachment.path) {
      throw new Error(
        `Attachment at index ${i} must include "content" (base64) or "path" (hosted URL).`,
      );
    }
    return attachment as Attachment;
  });
}

export function resolveAttachments(
  specs: string[] | undefined,
  attachmentsFile: string | undefined,
  globalOpts: GlobalOpts,
): Attachment[] | undefined {
  const fromSpecs = specs?.map((value): Attachment => {
    let spec: AttachmentSpec;
    try {
      spec = parseAttachmentSpec(value);
    } catch (err) {
      return outputError(
        { message: (err as Error).message, code: 'invalid_attachment' },
        { json: globalOpts.json },
      );
    }
    const metadata = {
      ...(spec.contentType && { contentType: spec.contentType }),
      ...(spec.contentId && { contentId: spec.contentId }),
    };
    if (spec.isUrl) {
      return {
        path: spec.source,
        ...(spec.filename && { filename: spec.filename }),
        ...metadata,
      };
    }
    try {
      return {
        filename: spec.filename ?? basename(spec.source),
        content: readFileSync(spec.source),
        ...metadata,
      };
    } catch {
      return outputError(
        {
          message: `Failed to read file: ${spec.source}`,
          code: 'file_read_error',
        },
        { json: globalOpts.json },
      );
    }
  });

  if (attachmentsFile === undefined) {
    return fromSpecs;
  }
  const raw = readFile(attachmentsFile, globalOpts);
  try {
    return [...(fromSpecs ?? []), ...parseAttachmentsJson(raw)];
  } catch (err) {
    return outputError(
      { message: (err as Error).message, code: 'invalid_attachment' },
      { json: globalOpts.json },
    );
  }
}

export function resolveDraftAttachments(
  specs: string[] | undefined,
  attachmentsFile: string | undefined,
  globalOpts: GlobalOpts,
): InboxDraftAttachmentOptions[] | undefined {
  return resolveAttachments(specs, attachmentsFile, globalOpts)?.map(
    (attachment) => {
      const { content, filename, contentType, path, contentId } = attachment;
      const fail = (problem: string): never =>
        outputError(
          {
            message: `Draft attachment "${filename ?? path ?? 'attachment'}" ${problem}.`,
            code: 'invalid_attachment',
          },
          { json: globalOpts.json },
        );
      if (path || content === undefined) {
        return fail('needs file content. A URL or path is not accepted');
      }
      if (contentId) {
        return fail('does not take a content ID (;cid= or content_id)');
      }
      if (!contentType) {
        return fail(
          'needs a MIME type. Add ;type=<type>, or content_type in the JSON file',
        );
      }
      if (!filename) {
        return fail('needs a filename');
      }
      return { content, filename, contentType };
    },
  );
}
