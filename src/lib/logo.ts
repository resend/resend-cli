import pc from 'picocolors';

const LOGO_LINES = [
  '   ██████╗ ███████╗███████╗███████╗███╗   ██╗██████╗ ',
  '   ██╔══██╗██╔════╝██╔════╝██╔════╝████╗  ██║██╔══██╗',
  '   ██████╔╝█████╗  ███████╗█████╗  ██╔██╗ ██║██║  ██║',
  '   ██╔══██╗██╔══╝  ╚════██║██╔══╝  ██║╚██╗██║██║  ██║',
  '   ██║  ██║███████╗███████║███████╗██║ ╚████║██████╔╝',
  '   ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝ ',
];

const LOGO_COLORS = [
  (t: string) => pc.white(pc.bold(t)),
  (t: string) => pc.white(t),
  (t: string) => pc.gray(pc.bold(t)),
  (t: string) => pc.gray(t),
  (t: string) => pc.dim(pc.gray(t)),
  (t: string) => pc.dim(pc.gray(t)),
];

export function printWelcome(version: string): void {
  process.stdout.write('\n');
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const line = LOGO_LINES[i];
    const color = LOGO_COLORS[i] ?? ((t: string) => t);
    process.stdout.write(`  ${color(line)}\n`);
  }
  process.stdout.write('\n');
  const cmd = (c: string) => pc.white(c);
  const dim = (t: string) => pc.dim(t);
  const CMD_WIDTH = 42;

  process.stdout.write(
    `  ${dim(`v${version}`)} ${dim('—')} ${pc.white('Power your emails with code')}\n`,
  );
  process.stdout.write('\n');

  const hints: [string, string][] = [
    ['resend --help', 'Display help and commands'],
    ['resend login | logout', 'Authenticate with Resend'],
    ['resend auth list | switch | remove', 'Manage profiles'],
    ['resend emails send | batch | receiving', 'Send and manage emails'],
    ['resend domains list | verify | create', 'Sending and receiving domains'],
    ['resend contacts list | create', 'Contacts and segments'],
    ['resend broadcasts list | send', 'Bulk email to segments'],
    ['resend webhooks list | create', 'Event notifications'],
    ['resend templates list | create', 'Reusable email templates'],
    [
      'resend whoami | doctor | open | update',
      'Status, health, dashboard, upgrade',
    ],
  ];

  for (const [command, description] of hints) {
    const pad = ' '.repeat(Math.max(0, CMD_WIDTH - command.length));
    process.stdout.write(
      `  ${dim('$')} ${cmd(command)}${pad} ${dim(description)}\n`,
    );
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${dim('try:')} ${cmd('resend login')}\n`);
  process.stdout.write(
    `  ${dim('Learn more at')} ${dim('https://resend.com/docs')}\n`,
  );
  process.stdout.write('\n');
}
