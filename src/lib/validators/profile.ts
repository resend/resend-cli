export function validateProfileName(name: string): string | undefined {
  if (!name || name.length === 0) {
    return 'Profile name must not be empty';
  }
  if (name.length > 64) {
    return 'Profile name must be 64 characters or fewer';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Profile name must contain only letters, numbers, dashes, and underscores';
  }
  return undefined;
}
