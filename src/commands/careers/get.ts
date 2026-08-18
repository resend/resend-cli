import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import {
  type Career,
  careerPickerConfig,
  renderCareerFieldsTable,
} from './utils';

export const getCareerCommand = new Command('get')
  .description('Get a job posting and its application form fields')
  .argument('[id]', 'Job posting ID (from `resend careers list`)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Shows the job posting details plus every application form field, including
the job-specific question paths accepted by \`resend careers apply --field\`.

Interactive mode without an ID shows a picker of open positions.`,
      output: `  {"object":"job_posting","id":"<id>","title":"<title>","fields":[{"path":"<path>","title":"<question>","type":"<type>","required":true}]}`,
      errorCodes: ['auth_error', 'missing_id', 'fetch_error'],
      examples: [
        'resend careers get',
        'resend careers get 053bde8f-294e-4cce-9d62-2301282120a2 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, careerPickerConfig, globalOpts);

    await runGet<Career>(
      {
        loading: 'Fetching job posting...',
        sdkCall: (resend) => resend.get<Career>(`/careers/${id}`),
        permission: 'sending_access',
        onInteractive: (job) => {
          const meta = [
            job.location,
            job.department,
            job.employment_type,
            job.workplace_type,
          ]
            .filter(Boolean)
            .join(' - ');

          console.log(job.title);
          if (meta) {
            console.log(meta);
          }
          if (job.compensation) {
            console.log(`Compensation: ${job.compensation}`);
          }
          console.log(`\n${renderCareerFieldsTable(job.fields)}`);
          console.log(`\nApply with: resend careers apply ${job.id}`);
        },
      },
      globalOpts,
    );
  });
