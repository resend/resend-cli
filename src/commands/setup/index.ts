import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';
import { claudeCodeCommand, setupClaudeCode } from './claude-code';
import { claudeDesktopCommand, setupClaudeDesktop } from './claude-desktop';
import { cursorCommand, setupCursor } from './cursor';
import { openclawCommand, setupOpenclaw } from './openclaw';
import { setupVscode, vscodeCommand } from './vscode';

const SETUP_FNS = {
  cursor: setupCursor,
  'claude-desktop': setupClaudeDesktop,
  'claude-code': setupClaudeCode,
  vscode: setupVscode,
  openclaw: setupOpenclaw,
} as const;

export const setupCommand = new Command('setup')
  .description('Configure AI tools to use Resend CLI as an MCP server')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Targets:
  cursor          Write MCP config to ~/.cursor/mcp.json
  claude-desktop  Write MCP config to Claude Desktop config file
  claude-code     Run \`claude mcp add resend -- npx -y resend-mcp\`
  vscode          Write .vscode/mcp.json in current directory
  openclaw        Create ~/clawd/skills/resend.md skill file

Behavior:
  \`resend setup\`            Auto-detect installed agents, prompt to select (interactive only)
  \`resend setup <target>\`   Configure a specific tool directly

All subcommands are idempotent — running them twice is safe.
Each subcommand outputs JSON when --json is set or stdout is not a TTY.

To install Resend Agent Skills for Claude Code:
  resend skills install`,
      errorCodes: [
        'missing_target',
        'config_write_error',
        'claude_mcp_add_failed',
      ],
      examples: [
        'resend setup',
        'resend setup cursor',
        'resend setup claude-desktop --json',
        'resend setup claude-code',
        'resend setup vscode',
        'resend setup openclaw',
      ],
    }),
  )
  .addCommand(cursorCommand)
  .addCommand(claudeDesktopCommand)
  .addCommand(claudeCodeCommand)
  .addCommand(vscodeCommand)
  .addCommand(openclawCommand)
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (!isInteractive()) {
      outputError(
        {
          message:
            'Specify a target in non-interactive mode: resend setup cursor|claude-desktop|claude-code|vscode|openclaw',
          code: 'missing_target',
        },
        { json: globalOpts.json },
      );
    }

    const home = homedir();
    const cwd = process.cwd();

    const claudeDesktopPath =
      process.platform === 'darwin'
        ? join(
            home,
            'Library',
            'Application Support',
            'Claude',
            'claude_desktop_config.json',
          )
        : process.platform === 'win32'
          ? join(
              process.env.APPDATA ?? home,
              'Claude',
              'claude_desktop_config.json',
            )
          : join(home, '.config', 'Claude', 'claude_desktop_config.json');

    const candidates = [
      {
        value: 'cursor' as const,
        label: 'Cursor',
        detected: existsSync(join(home, '.cursor')),
      },
      {
        value: 'claude-desktop' as const,
        label: 'Claude Desktop',
        detected: existsSync(claudeDesktopPath),
      },
      { value: 'claude-code' as const, label: 'Claude Code', detected: false },
      {
        value: 'vscode' as const,
        label: 'VS Code',
        detected: existsSync(join(cwd, '.vscode')),
      },
      {
        value: 'openclaw' as const,
        label: 'OpenClaw',
        detected: existsSync(join(home, 'clawd', 'skills')),
      },
    ];

    const options = candidates.map((c) => ({
      value: c.value,
      label: c.detected ? `${c.label} (detected)` : c.label,
    }));

    const selected = await p.multiselect({
      message: 'Which agents should be configured?',
      options,
      required: true,
    });

    if (p.isCancel(selected)) {
      cancelAndExit('Setup cancelled.');
    }

    for (const target of selected as Array<keyof typeof SETUP_FNS>) {
      await SETUP_FNS[target](globalOpts);
    }
  });
