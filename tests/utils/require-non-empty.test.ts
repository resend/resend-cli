import { describe, expect, it } from 'vitest';
import { requireNonEmpty } from '../../src/utils/require-non-empty';

describe('requireNonEmpty', () => {
  it('returns undefined when the value is undefined', () => {
    expect(requireNonEmpty(undefined, '--api-key')).toBeUndefined();
  });

  it('returns the value when it is non-empty', () => {
    expect(requireNonEmpty('re_key', '--api-key')).toBe('re_key');
  });

  it('throws when the value is an empty string', () => {
    expect(() => requireNonEmpty('', '--api-key')).toThrow(
      '--api-key is set but empty. Provide a non-empty value or remove it.',
    );
  });

  it('throws when the value is whitespace only', () => {
    expect(() => requireNonEmpty('   ', 'RESEND_PROFILE')).toThrow(
      'RESEND_PROFILE is set but empty. Provide a non-empty value or remove it.',
    );
  });
});
