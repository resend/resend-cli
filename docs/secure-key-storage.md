# Secure API Key Storage via macOS Keychain

## Context

API keys are currently stored as **plain text** in `~/.config/resend/credentials.json` (with `0o600` file permissions). The CLI already supports **multi-team profiles** — the credentials file has this structure:

```json
{ "active_team": "production", "teams": { "production": { "api_key": "re_..." }, "staging": { "api_key": "re_..." } } }
```

The keychain integration must preserve this multi-team model: each team's API key gets its own keychain entry, and team metadata (active team, team list) stays in the config file.

**Goal:** Move API key secrets into macOS Keychain while keeping team management metadata in the config file.

## Approach: Shell out to `/usr/bin/security`

Use macOS's built-in `security` CLI to interact with Keychain. Zero dependencies, works with Bun compiled binaries.

Each team gets its own keychain entry using the team name as the `account` field:
- `security add-generic-password -s resend-cli -a <team> -w <key> -U` (store/update)
- `security find-generic-password -s resend-cli -a <team> -w` (retrieve)
- `security delete-generic-password -s resend-cli -a <team>` (delete)

**Why not keytar (the prototype's approach):**
`bun build --compile` produces a self-contained binary with embedded JS bytecode. Native N-API addons (`.node` files) cannot be embedded — they require OS-level dynamic library loading at runtime. The release workflow (`.github/workflows/release.yml`) cross-compiles to 5 platform targets from a single Ubuntu runner, which further rules out native modules needing per-platform node-gyp compilation. The prototype uses keytar because it's a standard Node.js/oclif package where native modules compile during `npm install`.

**Why not other approaches:**
- **Bun FFI**: Hundreds of lines of C-interop for CoreFoundation/Security.framework — not worth it
- **Pure-JS wrappers**: Most just shell out to `security` internally anyway

## Key resolution priority (updated)

1. `--api-key` flag → source: `'flag'`
2. `RESEND_API_KEY` env var → source: `'env'`
3. **macOS Keychain** (for resolved team name) → source: `'keychain'` *(new)*
4. `credentials.json` teams → source: `'config'` *(kept as fallback)*

Team resolution is unchanged: `--team` flag > `RESEND_TEAM` env > `active_team` in config > `"default"`

## Storage model

**Keychain** stores secrets only:
- Service: `resend-cli`, Account: `<team-name>`, Password: `<api-key>`
- One entry per team

**Config file** (`credentials.json`) stores non-secret metadata:
- `active_team`: which team is currently active
- `teams`: record of team names (but **no more `api_key` fields** when keychain is available)

When keychain is available, the config file looks like:
```json
{ "active_team": "production", "teams": { "production": {}, "staging": {} } }
```

When keychain is unavailable (fallback), `api_key` is stored in the teams record as before.

## Migration strategy

No automatic migration. Both backends coexist:
- New `resend login` writes key to keychain + team metadata to config (no `api_key` in config)
- Old config files with `api_key` fields still work at lower priority
- `resend logout` / `resend teams remove` clean up both keychain entry and config
- Users naturally migrate when they next run `resend login`

## Files to change

### New: `src/lib/keychain.ts` (~60 lines)

Keychain abstraction wrapping `/usr/bin/security` via `child_process.execFile` (arg array, no shell — safe from injection).

```
keychainStore(team: string, apiKey: string): Promise<void>
keychainGet(team: string): Promise<string | null>       // null on not-found (exit code 44)
keychainDelete(team: string): Promise<boolean>
keychainAvailable(): boolean                             // process.platform === 'darwin' && existsSync('/usr/bin/security')
```

Constants: `SERVICE = 'resend-cli'`

### Modify: `src/lib/config.ts`

Current functions and how they change:

- `ApiKeySource` type: add `'keychain'`
- `TeamProfile` type: make `api_key` optional (`{ api_key?: string }`) — empty when key is in keychain
- `resolveApiKey(flagValue?, teamName?)` → **async**: after env check, try `keychainGet(team)` before falling back to config file's `api_key`
- `storeApiKey(apiKey, teamName?)` → **async**: if `keychainAvailable()`, store key in keychain and write team to config without `api_key`; otherwise write `api_key` to config as fallback
- `removeApiKey(teamName?)` → **async**: delete from keychain + remove team from config
- `removeTeam(teamName)` → **async**: delete from keychain + existing config cleanup
- `resolveTeamName`, `readCredentials`, `writeCredentials`, `setActiveTeam`, `listTeams`: unchanged (they don't touch API keys directly)

### Modify: `src/lib/client.ts`

- `createClient` and `requireClient` → **async** (add `await` to `resolveApiKey`)

### Modify: `src/commands/auth/login.ts`

- `await storeApiKey(apiKey, teamName)` (line 151)
- Update success message: "API key stored in macOS Keychain" vs "API key stored at {path}"
- `await resolveApiKey()` (line 71)

### Modify: `src/commands/auth/logout.ts`

- Check keychain + config to determine if logged in (not just file existence)
- `await removeApiKey()`
- Update confirmation message for keychain

### Modify: `src/commands/teams/remove.ts`

- `await removeTeam(name)` — needs to delete keychain entry too

### Modify: `src/commands/doctor.ts`

- `checkApiKeyPresence` → **async**: `await resolveApiKey()`
- `checkApiValidationAndDomains` → `await resolveApiKey()`
- Show `(source: keychain)` when applicable
- When source is `'config'`, hint: "run `resend login` to migrate to Keychain"

### Modify: `src/commands/setup/utils.ts` and `src/commands/setup/claude-code.ts`

- Add `await` to `resolveApiKey()` calls

### Update help text in: `src/cli.ts`, `login.ts`, `logout.ts`

- Reflect new priority chain mentioning Keychain

### New: `tests/lib/keychain.test.ts`

- Mock `execFile` to test store/get/delete without touching real keychain
- Test per-team accounts work correctly
- Test `keychainGet` returns `null` on exit code 44
- Test `keychainAvailable` returns `false` on non-darwin

### Update: existing tests

- Mock keychain module in config/auth tests

## File-based fallback hardening

When keychain is unavailable (headless Linux, CI, containers), the file-based backend is used with hardening:

1. **Warn on fallback**: When `storeApiKey` writes to file instead of keychain, print:
   `"⚠ No system keychain available. API key stored in plain text at {path}. Consider using RESEND_API_KEY env var instead."`

2. **Permission check on read**: When `resolveApiKey` reads from the config file, verify permissions are still `0o600`. If loosened, warn:
   `"⚠ Credentials file {path} has loose permissions. Run: chmod 600 {path}"`

3. **Doctor check**: Show storage backend and warn if using file-based storage on a platform that supports keychain.

**Industry context**: Plain text storage is common (AWS CLI, Stripe CLI, Heroku) but increasingly criticized. GitHub CLI now supports keychain (becoming default). Google Cloud uses encrypted SQLite. The trend is toward OS-level secure storage. The file fallback exists for environments where no keychain daemon is available.

## Future: Linux & Windows support

The `keychain.ts` module abstracts the backend per platform:

| Platform | System | CLI tool |
|----------|--------|----------|
| **macOS** | Keychain Access | `/usr/bin/security` |
| **Linux** | libsecret / GNOME Keyring | `secret-tool` (`libsecret-tools`) |
| **Windows** | Credential Manager | `cmdkey` or PowerShell |

To add a platform: add platform-specific functions in `keychain.ts` and extend `keychainAvailable()`. The file-based fallback always remains for headless/CI environments.

## Verification

1. `bun run build` — ensure compiled binary works
2. `resend login --key re_test` — stores in keychain, verify in Keychain Access.app under service "resend-cli"
3. `resend login --key re_staging` with `--team staging` — second keychain entry
4. `resend teams list` — shows both teams
5. `resend teams switch staging` → `resend doctor` — shows staging key from keychain
6. `resend teams remove staging` — deletes keychain entry
7. `resend logout` — removes active team's keychain entry
8. `RESEND_API_KEY=re_env resend doctor` — env override still works
9. Test with old `credentials.json` containing `api_key` fields — falls back to file
