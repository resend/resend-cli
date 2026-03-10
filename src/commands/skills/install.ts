import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

const REPO = 'resend/resend-skills';
const BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const TREE_API = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;

const EXCLUDED = [
  /^README\.md$/,
  /^LICENSE$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^tests\//,
  /^\./, // root-level dotfiles and dot-directories (.gitignore, .github/, etc.)
];

export type InstallTarget = { name: string; dir: string };

function shouldInclude(path: string): boolean {
  return !EXCLUDED.some((re) => re.test(path));
}

// Root SKILL.md lives in its own folder so it's consistent with sub-skills
function destPath(repoPath: string): string {
  return repoPath === 'SKILL.md' ? 'resend/SKILL.md' : repoPath;
}

// Project-level targets: covers Claude Code + all universal agents (cursor, codex, copilot, cline)
function projectTargets(cwd: string): InstallTarget[] {
  return [
    { name: 'claude-code', dir: join(cwd, '.claude', 'skills') },
    { name: 'agents', dir: join(cwd, '.agents', 'skills') },
  ];
}

// Global targets: only for agents detected on this machine
function detectedGlobalTargets(home: string): InstallTarget[] {
  return (
    [
      {
        name: 'claude-code',
        dir: join(home, '.claude', 'skills'),
        detect: join(home, '.claude'),
      },
      {
        name: 'cursor',
        dir: join(home, '.cursor', 'skills'),
        detect: join(home, '.cursor'),
      },
      {
        name: 'codex',
        dir: join(home, '.codex', 'skills'),
        detect: join(home, '.codex'),
      },
      {
        name: 'copilot',
        dir: join(home, '.copilot', 'skills'),
        detect: join(home, '.copilot'),
      },
      {
        name: 'openclaw',
        dir: join(home, '.openclaw', 'skills'),
        detect: join(home, '.openclaw'),
      },
    ] as Array<InstallTarget & { detect: string }>
  )
    .filter((t) => existsSync(t.detect))
    .map(({ name, dir }) => ({ name, dir }));
}

async function fetchTree(): Promise<string[]> {
  const res = await fetch(TREE_API, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub API responded with ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as {
    tree: Array<{ path: string; type: string }>;
  };
  return data.tree
    .filter((item) => item.type === 'blob' && shouldInclude(item.path))
    .map((item) => item.path);
}

async function fetchContent(path: string): Promise<string> {
  const res = await fetch(`${RAW_BASE}/${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function installSkills(
  targets: InstallTarget[],
  globalOpts: GlobalOpts,
): Promise<void> {
  const spinner = createSpinner('Fetching skill list from GitHub...');

  let paths: string[];
  try {
    paths = await fetchTree();
  } catch (err) {
    spinner.fail('Failed to fetch skill list');
    outputError(
      {
        message: `Failed to fetch skill list: ${errorMessage(err, 'unknown error')}`,
        code: 'fetch_error',
      },
      { json: globalOpts.json },
    );
  }

  spinner.update(
    `Installing ${paths.length} files to ${targets.length} target(s)...`,
  );

  // Fetch all file contents once, then write to every target
  const contents = new Map<string, string>();
  for (const repoPath of paths) {
    try {
      contents.set(repoPath, await fetchContent(repoPath));
    } catch (err) {
      spinner.fail(`Failed to fetch ${repoPath}`);
      outputError(
        {
          message: `Failed to fetch ${repoPath}: ${errorMessage(err, 'unknown error')}`,
          code: 'fetch_error',
        },
        { json: globalOpts.json },
      );
    }
  }

  for (const target of targets) {
    for (const [repoPath, content] of contents) {
      const dest = destPath(repoPath);
      const fullPath = join(target.dir, dest);
      try {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, 'utf8');
      } catch (err) {
        spinner.fail(`Failed to write to ${target.name}`);
        outputError(
          {
            message: `Failed to write ${dest} to ${target.name}: ${errorMessage(err, 'unknown error')}`,
            code: 'write_error',
          },
          { json: globalOpts.json },
        );
      }
    }
  }

  spinner.stop('Skills installed');

  const installed = Array.from(
    new Set(paths.map((p) => destPath(p).split('/')[0])),
  ).sort();

  if (!globalOpts.json && isInteractive()) {
    for (const skill of installed) {
      console.log(`  ✔ ${skill}`);
    }
    for (const target of targets) {
      console.log(`  → ${target.dir}`);
    }
  } else {
    outputResult(
      {
        installed,
        targets: targets.map((t) => ({ name: t.name, dir: t.dir })),
        files: paths.length,
      },
      { json: globalOpts.json },
    );
  }
}

export const installSkillsCommand = new Command('install')
  .description(
    'Install Resend Agent Skills from github.com/resend/resend-skills',
  )
  .option('--global', 'Install to global skill dirs for all detected agents')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Interactive mode (TTY):
  Runs \`npx skills add resend/resend-skills\` — the official skills CLI handles
  agent detection and lets you choose which agents to install to.

Non-interactive / agent mode (piped or --json):
  Fetches skills from https://github.com/resend/resend-skills and writes to:
  - Project (default): .claude/skills/  +  .agents/skills/
      Covers Claude Code, Cursor, Codex, Copilot, Cline in one pass.
  - Global (--global):  detected per-agent dirs
      ~/.claude/skills/  ~/.cursor/skills/  ~/.codex/skills/
      ~/.copilot/skills/  ~/.openclaw/skills/  (only for detected agents)

Skills installed:
  resend             Root skill — routes agent to the right sub-skill
  send-email         Transactional email, batch sends, retries, error handling
  resend-inbound     Receiving emails, webhooks, attachments
  templates          Create, publish, update, and delete email templates
  agent-email-inbox  AI agent email inbox with prompt injection protection`,
      output: `  {"installed":["agent-email-inbox","resend","resend-inbound","send-email","templates"],"targets":[{"name":"claude-code","dir":".claude/skills"},{"name":"agents","dir":".agents/skills"}],"files":12}`,
      errorCodes: ['fetch_error', 'write_error', 'install_error'],
      examples: [
        'resend skills install',
        'resend skills install --global',
        'resend skills install --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    // Interactive: delegate to the official skills CLI which handles agent detection + selection
    if (!globalOpts.json && isInteractive()) {
      try {
        execFileSync('npx', ['skills', 'add', 'resend/resend-skills'], {
          stdio: 'inherit',
        });
      } catch (err) {
        outputError(
          {
            message: `Failed to run npx skills: ${errorMessage(err, 'unknown error')}`,
            code: 'install_error',
          },
          { json: globalOpts.json },
        );
      }
      return;
    }

    // Non-interactive: deterministic fetch-and-write for agents and scripts
    const home = homedir();
    const cwd = process.cwd();
    const targets = opts.global
      ? detectedGlobalTargets(home)
      : projectTargets(cwd);
    await installSkills(targets, globalOpts);
  });
