import { Command, Option } from '@commander-js/extra-typings';
import type { CreateAutomationOptions } from 'resend';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { requireText } from '../../lib/prompts';
import { parseJsonFlag } from './utils';

export const createAutomationCommand = new Command('create')
  .description('Create a new automation')
  .option('--name <name>', 'Automation name')
  .addOption(
    new Option('--status <status>', 'Initial status').choices([
      'enabled',
      'disabled',
    ] as const),
  )
  .option('--steps <json>', 'Steps array as JSON string')
  .option('--edges <json>', 'Edges array as JSON string')
  .option(
    '--file <path>',
    'Path to a JSON file containing the full automation payload (use "-" for stdin)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --name and --steps/--edges (or --file) are required.

Payload format:
  --file accepts a JSON object with { name, status?, steps, edges }.
  --steps and --edges accept JSON arrays directly.
  When using --file, --name/--status/--steps/--edges flags override file values.

Step types: trigger, delay, send_email, wait_for_event, condition
Edge types: default, condition_met, condition_not_met, timeout, event_received`,
      output: '  {"object":"automation","id":"<id>"}',
      errorCodes: [
        'auth_error',
        'missing_name',
        'missing_steps',
        'missing_edges',
        'invalid_json',
        'file_read_error',
        'create_error',
      ],
      examples: [
        'resend automations create --file automation.json',
        'cat automation.json | resend automations create --file -',
        'resend automations create --file automation.json --status disabled',
        "resend automations create --name \"Welcome Flow\" --steps '[...]' --edges '[...]'",
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    let payload: Partial<CreateAutomationOptions> = {};

    if (opts.file) {
      const raw = readFile(opts.file, globalOpts);
      try {
        payload = JSON.parse(raw) as Partial<CreateAutomationOptions>;
      } catch {
        outputError(
          { message: 'Invalid JSON in --file.', code: 'invalid_json' },
          { json: globalOpts.json },
        );
      }
    }

    const name = await requireText(
      opts.name ?? payload.name,
      { message: 'Automation name', placeholder: 'e.g. Welcome Flow' },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    const steps = (parseJsonFlag(opts.steps, '--steps', globalOpts) ??
      payload.steps) as CreateAutomationOptions['steps'] | undefined;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      outputError(
        {
          message:
            'Missing or empty steps. Provide --steps as a JSON array or use --file.',
          code: 'missing_steps',
        },
        { json: globalOpts.json },
      );
    }

    const edges = (parseJsonFlag(opts.edges, '--edges', globalOpts) ??
      payload.edges) as CreateAutomationOptions['edges'] | undefined;

    if (!edges) {
      outputError(
        {
          message:
            'Missing edges. Provide --edges as a JSON array or use --file (empty array is valid for single-step automations).',
          code: 'missing_edges',
        },
        { json: globalOpts.json },
      );
    }

    if (!Array.isArray(edges)) {
      outputError(
        {
          message: '--edges must be a JSON array.',
          code: 'invalid_json',
        },
        { json: globalOpts.json },
      );
    }

    const status = opts.status ?? payload.status;

    await runCreate(
      {
        loading: 'Creating automation...',
        sdkCall: (resend) =>
          resend.automations.create({
            name,
            steps,
            edges,
            ...(status && { status }),
          }),
        onInteractive: (d) => {
          console.log(`Automation created: ${d.id}`);
        },
      },
      globalOpts,
    );
  });
