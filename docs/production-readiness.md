# Production Readiness Gaps

Tracked gaps identified during full CLI review. Items are ordered by severity.

---

## Blockers

### `removeApiKey()` crashes when no credentials file exists

`src/lib/config.ts` — `unlinkSync()` called without try-catch. Running `resend auth logout` when not logged in throws an unhandled exception instead of a graceful error.

### `emails send` missing attachment support

The Resend API supports `attachments` on send but the CLI does not expose an `--attach <path>` flag. This is a core email feature users will expect before adopting the CLI.

### `emails send` missing `--scheduled-at`

The API supports scheduled sending and broadcasts already expose `--scheduled-at`, but single email send does not.

### Distribution: Homebrew tap and additional package managers

The release pipeline builds binaries and publishes GitHub Releases, but there is no official Homebrew tap under the `resend` org. The previous reference to a personal tap (`rafa-thayto/homebrew-tap`) was removed. Before launch, set up:

- **Homebrew** — Create `resend/homebrew-tap` with a formula that downloads the correct binary from GitHub Releases. Wire the release workflow to auto-update the formula on new tags.
- **npm** — The package defines a `bin` entry but is not currently published to npm. `npm install -g @resend/cli` would be the expected install path for Node.js users.
- **AUR / Scoop / winget** — Consider community packages for Linux and Windows users who don't use the shell installer.

---

## High Priority

### No shell completions

No bash, zsh, or fish completion support exists. With 50+ commands and deeply nested subcommands, tab completion is essential for discoverability and usability.

### Inconsistent pagination on list commands

`api-keys list` and `topics list` lack the `--limit`, `--after`, and `--before` options that every other list command provides. This creates an inconsistent scripting surface.

**Files:** `src/commands/api-keys/list.ts`, `src/commands/topics/list.ts`

### No tests for `actions.ts` and `pagination.ts`

These are core shared modules (reusable action builders and pagination logic) used by nearly every command, yet they have zero test coverage.

**Files:** `src/lib/actions.ts`, `src/lib/pagination.ts`

### Batch >100 emails warns but does not error in non-interactive mode

`src/commands/emails/batch.ts` uses `console.warn()` when the batch exceeds 100 emails but continues execution. In CI or scripted mode this should hard-error since the API will reject the request.

---

## Medium Priority

### No output format options beyond JSON and table

List commands support `--json` or interactive tables only. Missing `--format csv` and `--format tsv` for data export workflows.

### No filter or search on list commands

No ability to filter results server-side (e.g. `--status verified` on domains, `--segment-id` on contacts). Users must fetch all pages and filter locally.

### No `resend update` or auto-update mechanism

Version check exists in `resend doctor` but there is no way to update the CLI from within it. Users must re-run the install script manually.

### `setup --uninstall` and `setup --dry-run` missing

The setup command can configure AI agent integrations but cannot undo or preview changes before applying them.

### No CLI-level retry logic for transient failures

The CLI relies entirely on the SDK's internal retries which are opaque. For batch and bulk operations, CLI-level retry with exponential backoff would be more robust and give users visibility into retries.

---

## Low Priority

### Table rendering does not truncate long values

Very long emails, domain names, or property values can break table alignment in narrow terminals.

### No `--silent` or `--quiet` flag

No way to suppress all non-essential output (spinners, hints, pagination messages) for scripting use cases.

### Contact email-vs-ID detection is fragile

`src/commands/contacts/utils.ts` uses `includes('@')` to decide whether a string is an email address or a contact ID. Edge cases could cause misidentification.

### No client-side input validation for domains and emails

Domain names and email addresses are accepted as-is and forwarded to the API. Client-side validation would provide faster, clearer error messages.

### Hardcoded API URLs prevent staging usage

No `--base-url` flag or `RESEND_BASE_URL` environment variable for pointing the CLI at non-production environments.
