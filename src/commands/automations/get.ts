import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { renderTable } from '../../lib/table';
import { automationPickerConfig, statusIndicator } from './utils';

export const getAutomationCommand = new Command('get')
  .description('Retrieve an automation with its steps and edges')
  .argument('[id]', 'Automation ID')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  Full automation object including steps and edges arrays.\n\nAutomation status values: enabled | disabled',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend automations get <id>',
        'resend automations get <id> --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, automationPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching automation...',
        sdkCall: (resend) => resend.automations.get(id),
        onInteractive: (a) => {
          console.log(`${a.name} — ${statusIndicator(a.status)}`);
          console.log(`ID: ${a.id}`);
          console.log(`Created: ${a.created_at}`);
          if (a.updated_at) {
            console.log(`Updated: ${a.updated_at}`);
          }
          if (a.steps.length > 0) {
            console.log('\nSteps:');
            const stepRows = a.steps.map((s) => [s.key, s.type]);
            console.log(renderTable(['Key', 'Type'], stepRows, '(no steps)'));
          }
          if (a.connections.length > 0) {
            console.log('\nConnections:');
            const connRows = a.connections.map((c) => [c.from, c.to, c.type]);
            console.log(
              renderTable(['From', 'To', 'Type'], connRows, '(no connections)'),
            );
          }
        },
      },
      globalOpts,
    );
  });
