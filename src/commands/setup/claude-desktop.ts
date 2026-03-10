import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { writeMcpJsonConfig } from './utils';

function claudeDesktopConfigPath(): string {
  const home = homedir();
  if (process.platform === 'darwin') {
    return join(
      home,
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
  }
  if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? home,
      'Claude',
      'claude_desktop_config.json',
    );
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

export async function setupClaudeDesktop(
  globalOpts: GlobalOpts,
): Promise<void> {
  const configPath = claudeDesktopConfigPath();
  await writeMcpJsonConfig(
    configPath,
    'mcpServers',
    'claude-desktop',
    'Claude Desktop',
    globalOpts,
    'Restart Claude Desktop for changes to take effect.',
  );
}

export const claudeDesktopCommand = new Command('claude-desktop')
  .description('Configure Claude Desktop to use Resend as an MCP server')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `What it does:
  Reads the Claude Desktop config file, upserts the "resend" MCP server entry, writes back.
  Existing entries (including other mcpServers and top-level keys like "preferences") are preserved.

Config paths:
  macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
  Windows: %APPDATA%/Claude/claude_desktop_config.json
  Linux:   ~/.config/Claude/claude_desktop_config.json

Config written:
  {
    "mcpServers": {
      "resend": {
        "command": "npx",
        "args": ["-y", "resend-mcp"],
        "env": { "RESEND_API_KEY": "<your-api-key>" }
      }
    }
  }

After running:
  Restart Claude Desktop for the new MCP server to be loaded.`,
      output: `  {"configured":true,"tool":"claude-desktop","config_path":"<platform-specific-path>"}`,
      errorCodes: ['config_write_error'],
      examples: [
        'resend setup claude-desktop',
        'resend setup claude-desktop --json',
      ],
    }),
  )
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupClaudeDesktop(globalOpts);
  });
