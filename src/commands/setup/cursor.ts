import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { writeMcpJsonConfig } from './utils';

export async function setupCursor(globalOpts: GlobalOpts): Promise<void> {
  const configPath = join(homedir(), '.cursor', 'mcp.json');
  await writeMcpJsonConfig(
    configPath,
    'mcpServers',
    'cursor',
    'Cursor',
    globalOpts,
    'Restart Cursor for changes to take effect.',
  );
}

export const cursorCommand = new Command('cursor')
  .description('Configure Cursor to use Resend as an MCP server')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `What it does:
  Reads ~/.cursor/mcp.json, upserts the "resend" MCP server entry, writes back.
  Existing entries in mcpServers are preserved (idempotent).

Config written:
  ~/.cursor/mcp.json
  {
    "mcpServers": {
      "resend": {
        "command": "npx",
        "args": ["-y", "resend-mcp"],
        "env": { "RESEND_API_KEY": "<your-api-key>" }
      }
    }
  }`,
      output: `  {"configured":true,"tool":"cursor","config_path":"~/.cursor/mcp.json"}`,
      errorCodes: ['config_write_error'],
      examples: ['resend setup cursor', 'resend setup cursor --json'],
    }),
  )
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupCursor(globalOpts);
  });
