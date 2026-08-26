import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { cancelAndExit, pickItem } from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import { type Career, type CareerField, careerPickerConfig } from './utils';

const RESUME_MAX_BYTES = 10 * 1024 * 1024;

const RESUME_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

const SKIP_OPTION = '__skip__';

export const applyCareerCommand = new Command('apply')
  .description('Apply to an open position at Resend')
  .argument('[id]', 'Job posting ID (from `resend careers list`)')
  .option('--name <name>', 'Your full name')
  .option('--email <email>', 'Your email address')
  .option('--resume <path>', 'Path to your resume file (PDF, max 10MB)')
  .option(
    '--field <path=value...>',
    'Answer a job-specific question by field path (repeatable: --field <path>=<answer>). Field paths are shown on the job posting page at resend.com/careers',
  )
  .option('--yes', 'Skip the confirmation prompt in interactive mode')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Interactive: run without flags to pick a position and answer each application
question in a guided form. Flags pre-fill their matching questions.

Non-interactive: --name, --email, and --resume are required, plus the job posting
ID argument. Answer job-specific questions with --field <path>=<value>, where
<path> is shown on the job posting page at resend.com/careers (custom questions
use UUID paths).

The resume is uploaded as multipart form data (max 10MB, PDF recommended).`,
      output: `  {"success":true}`,
      errorCodes: [
        'auth_error',
        'missing_id',
        'list_error',
        'missing_name',
        'missing_email',
        'missing_resume',
        'invalid_field',
        'file_read_error',
        'invalid_resume',
        'fetch_error',
        'apply_error',
      ],
      examples: [
        'resend careers apply',
        `resend careers apply 053bde8f-294e-4cce-9d62-2301282120a2 --name "Ada Lovelace" --email ada@example.com --resume ./resume.pdf --field 'd5cef330-d154-4f3a-8c5a-092986c61fe3=I love email infrastructure.'`,
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const answers = new Map<string, string>();
    for (const [path, value] of parseFieldOptions(opts.field, globalOpts)) {
      answers.set(path, value);
    }
    if (opts.name !== undefined) {
      answers.set('name', opts.name);
    }
    if (opts.email !== undefined) {
      answers.set('email', opts.email);
    }

    const canPrompt = isInteractive() && !globalOpts.json;
    const picked = await pickItem(idArg, careerPickerConfig, globalOpts);
    const jobId = picked.id;

    let resumePath = opts.resume;
    let jobTitle = picked.label;

    if (canPrompt) {
      const resend = await requireClient(globalOpts, {
        permission: 'sending_access',
      });
      const job = await withSpinner(
        'Fetching the application form...',
        () => resend.get<Career>(`/careers/${jobId}`),
        'fetch_error',
        globalOpts,
        { retryTransient: true },
      );
      jobTitle = job.title;

      p.intro(
        job.location
          ? `Apply to ${job.title} - ${job.location}`
          : `Apply to ${job.title}`,
      );

      for (const field of job.fields) {
        if (field.path === 'resume') {
          resumePath = resumePath ?? (await promptResumePath(field.title));
          continue;
        }
        // The apply endpoint only accepts a single file, at the resume field.
        if (field.type === 'File') {
          p.log.warn(
            `Skipping "${field.title}": only the resume file can be uploaded here. Apply on the careers page to include it.`,
          );
          continue;
        }
        if (answers.has(field.path)) {
          continue;
        }
        const value = await promptField(field);
        if (value !== undefined) {
          answers.set(field.path, value);
        }
      }

      // The API always requires these three, even if the form definition
      // ever omits them.
      if (!answers.has('name')) {
        answers.set('name', await promptRequiredText('Name'));
      }
      if (!answers.has('email')) {
        answers.set('email', await promptRequiredText('Email'));
      }
      resumePath = resumePath ?? (await promptResumePath('Resume'));

      if (!opts.yes) {
        await confirmSubmission(job, answers, resumePath);
      }
    } else {
      if (!answers.get('name')) {
        outputError(
          { message: 'Missing --name flag.', code: 'missing_name' },
          { json: globalOpts.json },
        );
      }
      if (!answers.get('email')) {
        outputError(
          { message: 'Missing --email flag.', code: 'missing_email' },
          { json: globalOpts.json },
        );
      }
      if (!resumePath) {
        outputError(
          { message: 'Missing --resume flag.', code: 'missing_resume' },
          { json: globalOpts.json },
        );
      }
    }

    const resume = readResume(resumePath, globalOpts);

    const form = new FormData();
    for (const [path, value] of answers) {
      form.append(path, value);
    }
    form.append('resume', resume.blob, resume.filename);

    const resend = await requireClient(globalOpts, {
      permission: 'sending_access',
    });
    const data = await withSpinner(
      'Submitting application...',
      () =>
        resend.fetchRequest<{ success: boolean }>(`/careers/${jobId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resend.key}`,
            'User-Agent': process.env.RESEND_USER_AGENT ?? '',
          },
          body: form,
        }),
      'apply_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      p.outro(
        `Application submitted for ${jobTitle}. Thanks for applying to Resend!`,
      );
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });

function parseFieldOptions(
  entries: string[] | undefined,
  globalOpts: GlobalOpts,
): Map<string, string> {
  const fields = new Map<string, string>();
  for (const entry of entries ?? []) {
    const separator = entry.indexOf('=');
    if (separator <= 0) {
      outputError(
        {
          message: `Invalid --field value "${entry}". Use --field <path>=<value>.`,
          code: 'invalid_field',
        },
        { json: globalOpts.json },
      );
    }
    fields.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  return fields;
}

async function promptField(field: CareerField): Promise<string | undefined> {
  const message = field.required ? field.title : `${field.title} (optional)`;

  if (field.selectable_values && field.selectable_values.length > 0) {
    const options = [
      ...(field.required ? [] : [{ value: SKIP_OPTION, label: 'Skip' }]),
      ...field.selectable_values.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ];
    const result = await p.select({ message, options });
    if (p.isCancel(result)) {
      cancelAndExit('Application cancelled.');
    }
    return result === SKIP_OPTION ? undefined : result;
  }

  if (field.type === 'Boolean') {
    const options = [
      ...(field.required ? [] : [{ value: SKIP_OPTION, label: 'Skip' }]),
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ];
    const result = await p.select({ message, options });
    if (p.isCancel(result)) {
      cancelAndExit('Application cancelled.');
    }
    return result === SKIP_OPTION ? undefined : result;
  }

  const result = await p.text({
    message,
    ...(field.description ? { placeholder: field.description } : {}),
    validate: (value) => {
      const trimmed = value?.trim() ?? '';
      if (field.required && trimmed.length === 0) {
        return `${field.title} is required`;
      }
      if (trimmed && field.type === 'Email' && !trimmed.includes('@')) {
        return 'Enter a valid email address';
      }
      if (trimmed && field.type === 'Number' && Number.isNaN(Number(trimmed))) {
        return 'Enter a number';
      }
      return undefined;
    },
  });
  if (p.isCancel(result)) {
    cancelAndExit('Application cancelled.');
  }
  const value = result?.trim() ?? '';
  return value.length > 0 ? value : undefined;
}

async function promptRequiredText(title: string): Promise<string> {
  const result = await p.text({
    message: title,
    validate: (value) =>
      !value || value.trim().length === 0 ? `${title} is required` : undefined,
  });
  if (p.isCancel(result)) {
    cancelAndExit('Application cancelled.');
  }
  return result.trim();
}

async function promptResumePath(title: string): Promise<string> {
  const result = await p.text({
    message: `${title} (path to a local file, PDF recommended)`,
    placeholder: './resume.pdf',
    validate: (value) =>
      !value || value.trim().length === 0
        ? 'A resume file is required'
        : undefined,
  });
  if (p.isCancel(result)) {
    cancelAndExit('Application cancelled.');
  }
  return result.trim();
}

async function confirmSubmission(
  job: Career,
  answers: Map<string, string>,
  resumePath: string,
): Promise<void> {
  const fieldByPath = new Map(job.fields.map((field) => [field.path, field]));
  const lines = [...answers.entries()].map(([path, value]) => {
    const field = fieldByPath.get(path);
    const label = field?.title ?? path;
    const display =
      field?.type === 'Boolean'
        ? value === 'true'
          ? 'Yes'
          : value === 'false'
            ? 'No'
            : value
        : value;
    return `${label}: ${truncate(display, 80)}`;
  });
  lines.push(`Resume: ${basename(resumePath)}`);

  p.note(lines.join('\n'), 'Application summary');

  const confirmed = await p.confirm({ message: 'Submit this application?' });
  if (p.isCancel(confirmed) || !confirmed) {
    cancelAndExit('Application not submitted.');
  }
}

function truncate(value: string, max: number): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  return singleLine.length > max
    ? `${singleLine.slice(0, max - 3)}...`
    : singleLine;
}

function readResume(
  resumePath: string,
  globalOpts: GlobalOpts,
): { blob: Blob; filename: string } {
  let content: Buffer;
  try {
    content = readFileSync(resumePath);
  } catch {
    outputError(
      {
        message: `Failed to read file: ${resumePath}`,
        code: 'file_read_error',
      },
      { json: globalOpts.json },
    );
  }

  if (content.length > RESUME_MAX_BYTES) {
    outputError(
      {
        message: 'Resume file is too large. Maximum size is 10MB.',
        code: 'invalid_resume',
      },
      { json: globalOpts.json },
    );
  }

  const contentType =
    RESUME_CONTENT_TYPES[extname(resumePath).toLowerCase()] ??
    'application/octet-stream';

  return {
    blob: new Blob([new Uint8Array(content)], { type: contentType }),
    filename: basename(resumePath),
  };
}
