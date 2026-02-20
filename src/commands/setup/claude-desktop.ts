import { Command } from '@commander-js/extra-typings';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GlobalOpts } from '../../lib/client';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { mergeJsonConfig } from './utils';

const RESEND_MCP_ENTRY = { command: 'resend', args: ['mcp', 'serve'] };

function claudeDesktopConfigPath(): string {
  const home = homedir();
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? home, 'Claude', 'claude_desktop_config.json');
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

export async function setupClaudeDesktop(globalOpts: GlobalOpts): Promise<void> {
  const configPath = claudeDesktopConfigPath();

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
      { message: `Failed to write Claude Desktop config: ${errorMessage(err, 'unknown error')}`, code: 'config_write_error' },
      { json: globalOpts.json },
    );
  }

  if (!globalOpts.json && isInteractive()) {
    console.log(`  ✔ Claude Desktop configured: ${configPath}`);
    console.log('  Restart Claude Desktop for changes to take effect.');
  } else {
    outputResult({ configured: true, tool: 'claude-desktop', config_path: configPath }, { json: globalOpts.json });
  }
}

export const claudeDesktopCommand = new Command('claude-desktop')
  .description('Configure Claude Desktop to use Resend as an MCP server')
  .addHelpText('after', `
What it does:
  Reads the Claude Desktop config file, upserts the "resend" MCP server entry, writes back.
  Existing entries (including other mcpServers and top-level keys like "preferences") are preserved.

Config paths:
  macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
  Windows: %APPDATA%/Claude/claude_desktop_config.json
  Linux:   ~/.config/Claude/claude_desktop_config.json

Config written:
  {
    "mcpServers": {
      "resend": { "command": "resend", "args": ["mcp", "serve"] }
    }
  }

After running:
  Restart Claude Desktop for the new MCP server to be loaded.

Examples:
  $ resend setup claude-desktop
  $ resend setup claude-desktop --json`)
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupClaudeDesktop(globalOpts);
  });
