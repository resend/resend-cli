import { errorMessage, outputError } from './output';

const CANCEL_EXIT_CODE = 130;

function defaultSigintHandler(): void {
  if (process.stderr.isTTY) {
    process.stderr.write('\r\x1B[2K');
  }
  console.error('Cancelled.');
  process.exit(CANCEL_EXIT_CODE);
}

let currentSigintHandler: (() => void) | undefined;

export function setupCliExitHandler(): void {
  currentSigintHandler = defaultSigintHandler;
  process.on('SIGINT', currentSigintHandler);

  process.on('uncaughtException', (err: unknown) => {
    outputError(
      {
        message: errorMessage(err, 'An unexpected error occurred'),
        code: 'unexpected_error',
      },
      {},
    );
    process.exit(1);
  });
}

export function setSigintHandler(handler: () => void): void {
  if (currentSigintHandler) {
    process.removeListener('SIGINT', currentSigintHandler);
  }
  currentSigintHandler = handler;
  process.on('SIGINT', currentSigintHandler);
}

export function getCancelExitCode(): number {
  return CANCEL_EXIT_CODE;
}
