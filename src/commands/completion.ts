import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import * as p from '@clack/prompts';
import { Argument, Command } from '@commander-js/extra-typings';
import {
  collectCommandTree,
  generateBashCompletion,
  generateFishCompletion,
  generatePowerShellCompletion,
  generateZshCompletion,
} from '../lib/completion';
import { buildHelpText } from '../lib/help-text';
import { cancelAndExit } from '../lib/prompts';
import { isInteractive } from '../lib/tty';

const SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;
type Shell = (typeof SHELLS)[number];

const MARKER = '# resend shell completion';

function detectShell(): Shell | undefined {
  const shell = process.env.SHELL;
  if (shell) {
    const name = basename(shell);
    if (name === 'bash') {
      return 'bash';
    }
    if (name === 'zsh') {
      return 'zsh';
    }
    if (name === 'fish') {
      return 'fish';
    }
  }
  if (process.env.PSModulePath) {
    return 'powershell';
  }
  return undefined;
}

async function resolveShell(explicit?: string): Promise<Shell> {
  if (explicit) {
    return explicit as Shell;
  }

  const detected = detectShell();
  if (detected) {
    return detected;
  }

  if (!isInteractive()) {
    process.stderr.write(
      'error: could not detect shell. Pass the shell name explicitly.\n',
    );
    process.exit(1);
  }

  const result = await p.select({
    message: 'Which shell do you use?',
    options: SHELLS.map((s) => ({ value: s, label: s })),
  });
  if (p.isCancel(result)) {
    cancelAndExit('Cancelled.');
  }
  return result;
}

function getProfilePath(shell: 'bash' | 'zsh' | 'powershell'): string {
  switch (shell) {
    case 'bash':
      return process.platform === 'darwin'
        ? join(homedir(), '.bash_profile')
        : join(homedir(), '.bashrc');
    case 'zsh':
      return join(homedir(), '.zshrc');
    case 'powershell':
      if (process.platform === 'win32') {
        return join(
          homedir(),
          'Documents',
          'PowerShell',
          'Microsoft.PowerShell_profile.ps1',
        );
      }
      return join(
        homedir(),
        '.config',
        'powershell',
        'Microsoft.PowerShell_profile.ps1',
      );
  }
}

function generateScript(
  shell: Shell,
  tree: ReturnType<typeof collectCommandTree>,
): string {
  switch (shell) {
    case 'bash':
      return generateBashCompletion(tree);
    case 'zsh':
      return generateZshCompletion(tree);
    case 'fish':
      return generateFishCompletion(tree);
    case 'powershell':
      return generatePowerShellCompletion(tree);
  }
}

function installCompletionFile(
  dir: string,
  filename: string,
  script: string,
): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = join(dir, filename);
  writeFileSync(filePath, `${script}\n`);
  return filePath;
}

function installCompletion(shell: Shell, script: string): void {
  switch (shell) {
    case 'zsh': {
      const completionDir = join(homedir(), '.zsh', 'completions');
      const filePath = installCompletionFile(completionDir, '_resend', script);
      p.log.success(`Completions written to ${filePath}`);

      const profilePath = getProfilePath(shell);
      let needsFpath = true;

      if (existsSync(profilePath)) {
        const content = readFileSync(profilePath, 'utf8');
        if (content.includes(completionDir)) {
          needsFpath = false;
        }
      }

      if (needsFpath) {
        const fpathLine = `${MARKER}\nfpath=(${completionDir} $fpath)\n`;
        const existing = existsSync(profilePath)
          ? readFileSync(profilePath, 'utf8')
          : '';
        const compinitMatch = existing.match(/^.*compinit.*$/m);
        if (compinitMatch) {
          const idx = existing.indexOf(compinitMatch[0]);
          const before = existing.slice(0, idx);
          const after = existing.slice(idx);
          writeFileSync(profilePath, `${before}${fpathLine}\n${after}`);
        } else {
          const snippet = `\n${fpathLine}autoload -Uz compinit && compinit\n`;
          writeFileSync(profilePath, snippet, { flag: 'a' });
        }
        p.log.info(`Added completion path to ${profilePath}`);
      }
      p.log.info('Restart your shell to activate completions.');
      return;
    }

    case 'fish': {
      const completionDir = join(homedir(), '.config', 'fish', 'completions');
      const filePath = installCompletionFile(
        completionDir,
        'resend.fish',
        script,
      );
      p.log.success(`Completions written to ${filePath}`);
      p.log.info('Completions will be available in new fish sessions.');
      return;
    }

    case 'bash':
    case 'powershell': {
      const profilePath = getProfilePath(shell);
      const snippet =
        shell === 'powershell'
          ? `\n${MARKER}\nresend completion powershell | Invoke-Expression\n`
          : `\n${MARKER}\neval "$(resend completion ${shell})"\n`;

      if (existsSync(profilePath)) {
        const content = readFileSync(profilePath, 'utf8');
        if (content.includes(MARKER)) {
          p.log.info(`Completions already installed in ${profilePath}`);
          return;
        }
      }

      const dir = dirname(profilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(profilePath, snippet, { flag: 'a' });
      p.log.success(`Completions added to ${profilePath}`);
      p.log.info('Restart your shell to activate completions.');
      return;
    }
  }
}

export const completionCommand = new Command('completion')
  .description('Generate shell completion script')
  .addArgument(new Argument('[shell]', 'Shell type').choices(SHELLS))
  .option('--install', 'Install completions into your shell profile')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Outputs a completion script for the given shell. The shell is auto-detected
from $SHELL when not specified.

Quick setup:
  resend completion --install

Manual setup:

  Bash (add to ~/.bashrc):
    eval "$(resend completion bash)"

  Zsh (add to ~/.zshrc):
    eval "$(resend completion zsh)"

  Fish:
    resend completion fish > ~/.config/fish/completions/resend.fish

  PowerShell (add to $PROFILE):
    resend completion powershell >> $PROFILE

Homebrew users: completions may be configured automatically by your formula.`,
      examples: [
        'resend completion --install',
        'resend completion bash',
        'resend completion zsh',
        'eval "$(resend completion bash)"',
      ],
    }),
  )
  .action(async (explicitShell, opts, cmd) => {
    const shell = await resolveShell(explicitShell);

    const root = cmd.parent;
    if (!root) {
      throw new Error('completion command must be registered under a parent');
    }
    const tree = collectCommandTree(root as Command);
    const script = generateScript(shell, tree);

    if (opts.install) {
      installCompletion(shell, script);
      return;
    }

    if (!explicitShell && isInteractive()) {
      cmd.help();
      return;
    }

    console.log(script);
  });
