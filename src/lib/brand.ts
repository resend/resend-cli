import pc from 'picocolors';
import { isUnicodeSupported } from './tty';

export const TAGLINE = 'Email for developers';

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
export const TICK = isUnicodeSupported ? String.fromCodePoint(0x2714) : 'v'; // ✔
export const WARN = isUnicodeSupported ? String.fromCodePoint(0x26a0) : '!'; // ⚠
export const CROSS = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

export function wordmark(bold = true): string {
  return bold ? pc.bold('Resend') : 'Resend';
}

export function divider(width = 40): string {
  const char = isUnicodeSupported ? String.fromCodePoint(0x2500) : '-';
  return pc.dim(char.repeat(width));
}
