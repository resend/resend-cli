export class CorruptedCredentialsError extends Error {
  constructor(filePath: string) {
    super(
      `Credentials file is corrupted or contains invalid JSON: ${filePath}\n` +
        'The file has been preserved for manual inspection.\n' +
        'To fix: either repair the JSON manually, or delete the file and run: resend login',
    );
    this.name = 'CorruptedCredentialsError';
  }
}
