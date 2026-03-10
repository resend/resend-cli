import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { writeMcpJsonConfig } from './utils';

export async function setupVscode(globalOpts: GlobalOpts): Promise<void> {
  const configPath = join(process.cwd(), '.vscode', 'mcp.json');
  await writeMcpJsonConfig(
    configPath,
    'servers',
    'vscode',
    'VS Code',
    globalOpts,
  );
}

export const vscodeCommand = new Command('vscode')
  .description(
    'Write .vscode/mcp.json in the current directory for VS Code MCP',
  )
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `What it does:
  Writes .vscode/mcp.json in the CURRENT WORKING DIRECTORY.
  Uses the "servers" key (VS Code format — different from Cursor/Claude Desktop).
  Existing "servers" entries are preserved (idempotent).

Config written:
  .vscode/mcp.json
  {
    "servers": {
      "resend": {
        "command": "npx",
        "args": ["-y", "resend-mcp"],
        "env": { "RESEND_API_KEY": "<your-api-key>" }
      }
    }
  }

Important format difference from other tools:
  - Key: "servers" (not "mcpServers")

Note: Run this command from your project root directory.`,
      output: `  {"configured":true,"tool":"vscode","config_path":"<cwd>/.vscode/mcp.json"}`,
      errorCodes: ['config_write_error'],
      examples: ['resend setup vscode', 'resend setup vscode --json'],
    }),
  )
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupVscode(globalOpts);
  });
