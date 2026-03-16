import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import {
  listProfiles,
  readCredentials,
  writeCredentials,
} from '../../lib/config';
import { getCredentialBackend, SERVICE_NAME } from '../../lib/credential-store';
import { buildHelpText } from '../../lib/help-text';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const migrateCommand = new Command('migrate')
  .description('Migrate credentials between storage backends')
  .option(
    '--insecure',
    'Migrate from keychain to plaintext file (reverse migration)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `By default, migrates all profile API keys from the plaintext file to the OS keychain.
Use --insecure to migrate from keychain back to plaintext file.

Profiles are migrated one at a time. The credentials file is updated to reflect
the new storage backend after all profiles are migrated.`,
      output: `  {"success":true,"migrated":["default","staging"],"backend":"macOS Keychain"}`,
      errorCodes: ['no_profiles', 'migration_failed', 'keychain_unavailable'],
      examples: [
        'resend auth migrate',
        'resend auth migrate --insecure',
        'resend auth migrate --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const toFile = opts.insecure ?? false;

    const profiles = listProfiles();
    if (profiles.length === 0) {
      outputError(
        {
          message: 'No profiles configured. Run `resend login` first.',
          code: 'no_profiles',
        },
        { json: globalOpts.json },
      );
      return;
    }

    const creds = readCredentials();
    if (!creds) {
      outputError(
        {
          message: 'No credentials file found. Run `resend login` first.',
          code: 'no_profiles',
        },
        { json: globalOpts.json },
      );
      return;
    }

    if (toFile) {
      // Migrate from keychain to file
      if (creds.storage !== 'keychain') {
        if (globalOpts.json) {
          outputResult(
            {
              success: true,
              migrated: [],
              message: 'Credentials are already stored in plaintext file.',
            },
            { json: true },
          );
        } else if (isInteractive()) {
          console.log(
            'Credentials are already stored in plaintext file. Nothing to migrate.',
          );
        }
        return;
      }

      const backend = await getCredentialBackend();

      let results: Array<{ name: string; key: string } | null>;
      try {
        results = await Promise.all(
          profiles.map(async (profile) => {
            const key = await backend.get(SERVICE_NAME, profile.name);
            if (key) {
              return { name: profile.name, key };
            }
            return null;
          }),
        );
      } catch (err) {
        outputError(
          {
            message: errorMessage(err, 'Failed to migrate profiles'),
            code: 'migration_failed',
          },
          { json: globalOpts.json },
        );
        return;
      }

      const migrated: string[] = [];
      for (const result of results) {
        if (result) {
          creds.profiles[result.name] = { api_key: result.key };
          migrated.push(result.name);
        }
      }

      delete creds.storage;
      writeCredentials(creds);

      // Delete from keychain after file write succeeds to prevent data loss
      try {
        await Promise.all(
          migrated.map((name) => backend.delete(SERVICE_NAME, name)),
        );
      } catch {
        // Deletion failure is non-fatal — keys exist in both places (safe)
      }

      if (globalOpts.json) {
        outputResult(
          { success: true, migrated, backend: 'plaintext file' },
          { json: true },
        );
      } else if (isInteractive()) {
        p.outro(
          `Migrated ${migrated.length} profile(s) to plaintext file: ${migrated.join(', ')}`,
        );
      }
    } else {
      // Migrate from file to keychain
      const keychainBackend = await getCredentialBackend();
      if (!keychainBackend.isSecure) {
        outputError(
          {
            message:
              'OS keychain is not available on this system. Cannot migrate.',
            code: 'keychain_unavailable',
          },
          { json: globalOpts.json },
        );
        return;
      }

      // Migrate profiles that still have plaintext api_key values (handles
      // mixed state where some profiles are already in keychain)
      const profilesToMigrate = profiles.filter(
        (p_) => creds.profiles[p_.name]?.api_key,
      );

      if (profilesToMigrate.length === 0) {
        if (globalOpts.json) {
          outputResult(
            {
              success: true,
              migrated: [],
              message: 'All profiles are already stored in keychain.',
            },
            { json: true },
          );
        } else if (isInteractive()) {
          console.log(
            'All profiles are already stored in keychain. Nothing to migrate.',
          );
        }
        return;
      }

      try {
        await Promise.all(
          profilesToMigrate
            .filter((profile) => creds.profiles[profile.name].api_key)
            .map((profile) =>
              keychainBackend.set(
                SERVICE_NAME,
                profile.name,
                creds.profiles[profile.name].api_key as string,
              ),
            ),
        );
      } catch (err) {
        outputError(
          {
            message: errorMessage(err, 'Failed to migrate profiles'),
            code: 'migration_failed',
          },
          { json: globalOpts.json },
        );
        return;
      }

      const migrated: string[] = [];
      for (const profile of profilesToMigrate) {
        creds.profiles[profile.name] = {};
        migrated.push(profile.name);
      }

      creds.storage = 'keychain';
      writeCredentials(creds);

      if (globalOpts.json) {
        outputResult(
          { success: true, migrated, backend: keychainBackend.name },
          { json: true },
        );
      } else if (isInteractive()) {
        p.outro(
          `Migrated ${migrated.length} profile(s) to ${keychainBackend.name}: ${migrated.join(', ')}`,
        );
      }
    }
  });
