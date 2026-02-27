import { Command } from '@commander-js/extra-typings';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GlobalOpts } from '../../lib/client';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

const SKILL_CONTENT = `---
name: resend
description: Use when working with the Resend email platform — sending emails, managing domains, contacts, segments, broadcasts, and API keys.
---

# Resend CLI

Send transactional emails, manage domains, contacts, segments, broadcasts, and API keys.

## Authentication

Set your API key in the environment before running commands:

\`\`\`
export RESEND_API_KEY=re_your_key_here
\`\`\`

Or store it permanently:

\`\`\`
resend auth login
\`\`\`

## Key Commands

### Send an email
\`\`\`
resend emails send \\
  --from sender@yourdomain.com \\
  --to recipient@example.com \\
  --subject "Subject line" \\
  --text "Plain text body"
\`\`\`

### Send HTML email from file
\`\`\`
resend emails send \\
  --from sender@yourdomain.com \\
  --to recipient@example.com \\
  --subject "Subject" \\
  --html-file /path/to/email.html
\`\`\`

### List domains
\`\`\`
resend domains list
\`\`\`

### Create a contact
\`\`\`
resend contacts create \\
  --email user@example.com \\
  --first-name Alice \\
  --last-name Smith
\`\`\`

### List contacts in a segment
\`\`\`
resend contacts list --segment-id <segment-id>
\`\`\`

### Create a broadcast (and send immediately)
\`\`\`
resend broadcasts create \\
  --from newsletter@yourdomain.com \\
  --subject "Newsletter" \\
  --segment-id <segment-id> \\
  --text "Hi there, here's the news." \\
  --send
\`\`\`

### Run health check
\`\`\`
resend doctor
\`\`\`

## Output Format

All commands output JSON automatically when stdout is not a TTY:

\`\`\`json
// Success
{ "id": "email_id_here", "object": "email" }

// Error (always exit code 1)
{ "error": { "message": "API key is invalid", "code": "auth_error" } }
\`\`\`

Use \`| jq\` to filter output:
\`\`\`
resend domains list | jq '.data[].name'
\`\`\`
`;

export async function setupOpenclaw(globalOpts: GlobalOpts): Promise<void> {
  const skillDir = join(homedir(), '.openclaw', 'skills', 'resend');
  const skillPath = join(skillDir, 'SKILL.md');

  try {
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(skillPath, SKILL_CONTENT, 'utf8');
  } catch (err) {
    outputError(
      { message: `Failed to write OpenClaw skill: ${errorMessage(err, 'unknown error')}`, code: 'config_write_error' },
      { json: globalOpts.json },
    );
  }

  if (!globalOpts.json && isInteractive()) {
    console.log(`  ✔ OpenClaw skill created: ${skillPath}`);
  } else {
    outputResult({ configured: true, tool: 'openclaw', config_path: skillPath }, { json: globalOpts.json });
  }
}

export const openclawCommand = new Command('openclaw')
  .description('Create ~/.openclaw/skills/resend/SKILL.md skill file for OpenClaw')
  .addHelpText('after', buildHelpText({
    setup: true,
    context: `What it does:
  Creates ~/.openclaw/skills/resend/SKILL.md — a skill file that teaches the OpenClaw agent
  how to authenticate and use the Resend CLI for sending email and managing resources.

Skill file path: ~/.openclaw/skills/resend/SKILL.md

The skill file covers:
  - Authentication via RESEND_API_KEY or \`resend auth login\`
  - Sending emails (plain text and HTML)
  - Managing domains, contacts, segments, and broadcasts
  - JSON output format for scripting
  - Health check via \`resend doctor\``,
    output: `  {"configured":true,"tool":"openclaw","config_path":"~/.openclaw/skills/resend/SKILL.md"}`,
    errorCodes: ['config_write_error'],
    examples: [
      'resend setup openclaw',
      'resend setup openclaw --json',
    ],
  }))
  .action((_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    return setupOpenclaw(globalOpts);
  });
