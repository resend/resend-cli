import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { resolveApiKey } from '../../lib/config';
import { buildHelpText } from '../../lib/help-text';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { mergeJsonConfig } from './utils';

export async function setupClaudeCode(globalOpts: GlobalOpts): Promise<void> {
  const resolved = resolveApiKey(globalOpts.apiKey);
  const mcpAddArgs = ['mcp', 'add', 'resend'];
  if (resolved?.key) {
    mcpAddArgs.push('-e', `RESEND_API_KEY=${resolved.key}`);
  }
  mcpAddArgs.push('--', 'npx', '-y', 'resend-mcp');

  try {
    execFileSync('claude', mcpAddArgs, { stdio: 'inherit' });
  } catch (err: unknown) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';

    if (!isNotFound) {
      return outputError(
        {
          message: `claude mcp add failed: ${errorMessage(err, 'unknown error')}`,
          code: 'claude_mcp_add_failed',
        },
        { json: globalOpts.json },
      );
    }

    // Fallback: `claude` binary not found — write ~/.claude.json directly
    const configPath = join(homedir(), '.claude.json');
    try {
      mergeJsonConfig(configPath, (existing) => ({
        ...existing,
        mcpServers: {
          ...(existing.mcpServers as Record<string, unknown> | undefined),
          resend: {
            command: 'npx',
            args: ['-y', 'resend-mcp'],
            env: { RESEND_API_KEY: resolved?.key ?? '' },
          },
        },
      }));
    } catch (writeErr) {
      outputError(
        {
          message: `Failed to write Claude Code config: ${errorMessage(writeErr, 'unknown error')}`,
          code: 'config_write_error',
        },
        { json: globalOpts.json },
      );
    }

    if (!globalOpts.json && isInteractive()) {
      console.log(
        `  ✔ Claude Code configured via ~/.claude.json (install \`claude\` CLI for full integration)`,
      );
      console.log('  Install Claude Code: https://claude.ai/download');
    } else {
      outputResult(
        {
          configured: true,
          tool: 'claude-code',
          method: 'direct_write',
          config_path: configPath,
        },
        { json: globalOpts.json },
      );
    }
    return;
  }

  if (!globalOpts.json && isInteractive()) {
    console.log('  ✔ Claude Code configured via `claude mcp add`');
    console.log('  Run `claude mcp list` to verify.');
  } else {
    outputResult(
      { configured: true, tool: 'claude-code', method: 'mcp_add' },
      { json: globalOpts.json },
    );
  }
}

export const claudeCodeCommand = new Command('claude-code')
  .description('Register Resend as an MCP server in Claude Code')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `What it does:
  Runs \`claude mcp add resend -- npx -y resend-mcp\` using the official Claude Code CLI.
  If the \`claude\` binary is not installed, falls back to writing ~/.claude.json directly.

Primary method (requires claude CLI):
  claude mcp add [-e RESEND_API_KEY=<key>] resend -- npx -y resend-mcp
  Verify with: claude mcp list

Fallback method (no claude CLI):
  Writes ~/.claude.json
  {
    "mcpServers": {
      "resend": {
        "command": "npx",
        "args": ["-y", "resend-mcp"],
        "env": { "RESEND_API_KEY": "<your-api-key>" }
      }
    }
  }

Install Claude Code CLI: https://claude.ai/download`,
      output: `  Primary:  {"configured":true,"tool":"claude-code","method":"mcp_add"}\n  Fallback: {"configured":true,"tool":"claude-code","method":"direct_write","config_path":"~/.claude.json"}`,
      errorCodes: ['claude_mcp_add_failed', 'config_write_error'],
      examples: ['resend setup claude-code', 'resend setup claude-code --json'],
    }),
  )
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupClaudeCode(globalOpts);
  });
