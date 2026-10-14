import { Command } from '@commander-js/extra-typings';
import { describe, expect, it } from 'vitest';
import { snakeCaseAlias } from '../../src/lib/snake-case-alias';

function buildCommand() {
  return new Command('test')
    .exitOverride()
    .option('--inbox-id <id>', 'Inbox UUID')
    .addOption(snakeCaseAlias('--inbox-id <id>'))
    .option('--add-label-ids <ids...>', 'Label UUIDs')
    .addOption(snakeCaseAlias('--add-label-ids <ids...>'))
    .option('--has-attachment', 'Only emails with an attachment')
    .addOption(snakeCaseAlias('--has-attachment'));
}

describe('snakeCaseAlias', () => {
  it('sets the kebab-case attribute from the snake_case flag', () => {
    const command = buildCommand();
    command.parse(
      [
        '--inbox_id',
        'inbox-1',
        '--add_label_ids',
        'a',
        'b',
        '--has_attachment',
      ],
      { from: 'user' },
    );
    expect(command.opts()).toStrictEqual({
      inboxId: 'inbox-1',
      addLabelIds: ['a', 'b'],
      hasAttachment: true,
    });
  });

  it('accepts the snake_case flag with an equals sign', () => {
    const command = buildCommand();
    command.parse(['--inbox_id=inbox-1'], { from: 'user' });
    expect(command.opts()).toStrictEqual({ inboxId: 'inbox-1' });
  });

  it('merges a variadic value given with both spellings', () => {
    const command = buildCommand();
    command.parse(['--add_label_ids', 'a', '--add-label-ids', 'b'], {
      from: 'user',
    });
    expect(command.opts()).toStrictEqual({ addLabelIds: ['a', 'b'] });
  });

  it('hides the snake_case flag from help', () => {
    const help = buildCommand().helpInformation();
    expect(help).toContain('--inbox-id <id>');
    expect(help).toContain('--add-label-ids <ids...>');
    expect(help).not.toContain('_');
  });
});
