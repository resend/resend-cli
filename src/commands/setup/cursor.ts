import { Command } from '@commander-js/extra-typings';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GlobalOpts } from '../../lib/client';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { mergeJsonConfig } from './utils';

const RESEND_MCP_ENTRY = { command: 'resend', args: ['mcp', 'serve'] };

export async function setupCursor(globalOpts: GlobalOpts): Promise<void> {
  const configPath = join(homedir(), '.cursor', 'mcp.json');

  try {
    mergeJsonConfig(configPath, (existing) => ({
      ...existing,
      mcpServers: {
        ...(existing.mcpServers as Record<string, unknown> | undefined),
        resend: RESEND_MCP_ENTRY,
      },
    }));
  } catch (err) {
    outputError(
      { message: `Failed to write Cursor config: ${errorMessage(err, 'unknown error')}`, code: 'config_write_error' },
      { json: globalOpts.json },
    );
  }

  if (!globalOpts.json && isInteractive()) {
    console.log(`  ✔ Cursor configured: ${configPath}`);
    console.log('  Restart Cursor for changes to take effect.');
  } else {
    outputResult({ configured: true, tool: 'cursor', config_path: configPath }, { json: globalOpts.json });
  }
}

export const cursorCommand = new Command('cursor')
  .description('Configure Cursor to use Resend as an MCP server')
  .addHelpText('after', `
What it does:
  Reads ~/.cursor/mcp.json, upserts the "resend" MCP server entry, writes back.
  Existing entries in mcpServers are preserved (idempotent).

Config written:
  ~/.cursor/mcp.json
  {
    "mcpServers": {
      "resend": { "command": "resend", "args": ["mcp", "serve"] }
    }
  }

Examples:
  $ resend setup cursor
  $ resend setup cursor --json`)
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupCursor(globalOpts);
  });
