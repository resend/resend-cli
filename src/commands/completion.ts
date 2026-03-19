import { Argument, Command } from '@commander-js/extra-typings';
import {
  collectCommandTree,
  generateBashCompletion,
  generateFishCompletion,
  generatePowerShellCompletion,
  generateZshCompletion,
} from '../lib/completion';
import { buildHelpText } from '../lib/help-text';

const SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;

export const completionCommand = new Command('completion')
  .description('Generate shell completion script')
  .addArgument(new Argument('<shell>', 'Shell type').choices(SHELLS))
  .addHelpText(
    'after',
    buildHelpText({
      context: `Outputs a completion script for the given shell. Source it in your shell
profile so that completions are available in every new session.

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
        'resend completion bash',
        'resend completion zsh >> ~/.zshrc',
        'resend completion fish > ~/.config/fish/completions/resend.fish',
        'eval "$(resend completion bash)"',
      ],
    }),
  )
  .action((shell, _opts, cmd) => {
    const root = cmd.parent;
    if (!root) {
      throw new Error('completion command must be registered under a parent');
    }
    const tree = collectCommandTree(root as Command);

    switch (shell) {
      case 'bash':
        console.log(generateBashCompletion(tree));
        break;
      case 'zsh':
        console.log(generateZshCompletion(tree));
        break;
      case 'fish':
        console.log(generateFishCompletion(tree));
        break;
      case 'powershell':
        console.log(generatePowerShellCompletion(tree));
        break;
    }
  });
