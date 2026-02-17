import spinners from 'unicode-animations';
import { isInteractive } from './tty';

export type SpinnerName = keyof typeof spinners;

export function createSpinner(message: string, name: SpinnerName = 'braille') {
  if (!isInteractive()) {
    return {
      update(_msg: string) {},
      stop(_msg: string) {},
      warn(_msg: string) {},
      fail(_msg: string) {},
    };
  }

  const { frames, interval } = spinners[name];
  let i = 0;
  let text = message;

  const timer = setInterval(() => {
    process.stderr.write(`\r\x1B[2K  ${frames[i++ % frames.length]} ${text}`);
  }, interval);

  return {
    update(msg: string) {
      text = msg;
    },
    stop(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ✔ ${msg}\n`);
    },
    warn(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ⚠ ${msg}\n`);
    },
    fail(msg: string) {
      clearInterval(timer);
      process.stderr.write(`\r\x1B[2K  ✗ ${msg}\n`);
    },
  };
}
