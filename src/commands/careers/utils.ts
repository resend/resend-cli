import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export type CareerFieldOption = {
  label: string;
  value: string;
};

export type CareerField = {
  path: string;
  title: string;
  type: string;
  required: boolean;
  description?: string;
  selectable_values?: CareerFieldOption[];
};

export type CareerSummary = {
  id: string;
  title: string;
  department: string | null;
  team: string | null;
  location: string | null;
  employment_type: string | null;
  workplace_type: string | null;
  published_at: string | null;
};

export type Career = CareerSummary & {
  object: 'job_posting';
  compensation: string | null;
  fields: CareerField[];
};

export type CareersListResponse = {
  object: 'list';
  data: CareerSummary[];
};

export const careerPickerConfig: PickerConfig<CareerSummary> = {
  resource: 'job posting',
  resourcePlural: 'job postings',
  fetchItems: async (resend) => {
    const { data, error } = await resend.get<CareersListResponse>('/careers');
    return {
      data: data ? { data: data.data, has_more: false } : null,
      error,
    };
  },
  display: (job) => ({ label: job.title, hint: job.location ?? job.id }),
};

export function renderCareersTable(jobs: CareerSummary[]): string {
  const rows = jobs.map((job) => [
    job.title,
    job.location ?? '',
    job.department ?? '',
    job.id,
  ]);
  return renderTable(
    ['Title', 'Location', 'Department', 'ID'],
    rows,
    '(no open positions)',
  );
}

export function renderCareerFieldsTable(fields: CareerField[]): string {
  const rows = fields.map((field) => [
    field.title,
    field.type,
    field.required ? 'yes' : 'no',
    field.path,
  ]);
  return renderTable(
    ['Question', 'Type', 'Required', 'Field path'],
    rows,
    '(no application fields)',
  );
}
