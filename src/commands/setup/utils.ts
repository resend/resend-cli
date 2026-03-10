import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GlobalOpts } from '../../lib/client';
import { resolveApiKey } from '../../lib/config';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

/**
 * Read an existing JSON config, apply `merge`, write back.
 * Creates the parent directory if it doesn't exist.
 * If the file doesn't exist, starts from {}.
 * Callers wrap in try/catch and call outputError on failure.
 */
export function mergeJsonConfig(
  filePath: string,
  merge: (existing: Record<string, unknown>) => Record<string, unknown>,
): void {
  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      // Malformed JSON — start fresh rather than error
      existing = {};
    }
  }
  const updated = merge(existing);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
}

/**
 * Write the Resend MCP server entry into a JSON config file.
 * Shared by cursor, claude-desktop, and vscode setup commands.
 */
export async function writeMcpJsonConfig(
  configPath: string,
  configKey: 'mcpServers' | 'servers',
  toolId: string,
  toolLabel: string,
  globalOpts: GlobalOpts,
  restartHint?: string,
): Promise<void> {
  const resolved = resolveApiKey(globalOpts.apiKey);

  try {
    mergeJsonConfig(configPath, (existing) => ({
      ...existing,
      [configKey]: {
        ...(existing[configKey] as Record<string, unknown> | undefined),
        resend: {
          command: 'npx',
          args: ['-y', 'resend-mcp'],
          env: { RESEND_API_KEY: resolved?.key ?? '' },
        },
      },
    }));
  } catch (err) {
    outputError(
      {
        message: `Failed to write ${toolLabel} config: ${errorMessage(err, 'unknown error')}`,
        code: 'config_write_error',
      },
      { json: globalOpts.json },
    );
  }

  if (!globalOpts.json && isInteractive()) {
    console.log(`  ✔ ${toolLabel} configured: ${configPath}`);
    if (restartHint) {
      console.log(`  ${restartHint}`);
    }
  } else {
    outputResult(
      { configured: true, tool: toolId, config_path: configPath },
      { json: globalOpts.json },
    );
  }
}
