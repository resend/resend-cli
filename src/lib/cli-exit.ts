import { errorMessage, outputError } from './output';

const CANCEL_EXIT_CODE = 130;

export function setupCliExitHandler(): void {
  process.on('SIGINT', () => {
    console.error('Cancelled.');
    process.exit(CANCEL_EXIT_CODE);
  });

  process.on('uncaughtException', (err: unknown) => {
    outputError(
      {
        message: errorMessage(err, 'An unexpected error occurred'),
        code: 'unexpected_error',
      },
      {},
    );
  });
}

export function getCancelExitCode(): number {
  return CANCEL_EXIT_CODE;
}
