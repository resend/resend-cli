# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.2.0] - 2026-02-18

### Added

**New command namespaces**

- `resend domains` — create, verify, get, list, update, delete sending domains
- `resend api-keys` — create, list, delete API keys
- `resend broadcasts` — create, send, get, list, update, delete broadcasts (with `--html-file` and pagination)
- `resend contacts` — create, get, list, update, delete contacts; manage segments (`segments`, `add-segment`, `remove-segment`) and topics (`topics`, `update-topics`)
- `resend emails batch` — send up to 100 emails in a single API call via a JSON file

**Shared library utilities**

- `requireClient(globalOpts)` — centralises API key resolution and auth error handling; replaces per-command try/catch blocks
- `cancelAndExit(message)` — typed as `never`; replaces inline `p.cancel + process.exit(0)` patterns
- `errorMessage(err, fallback)` — safe error message extraction for `catch` blocks
- `readHtmlFile(path)` / `readFile(path)` — file read helpers that exit with `file_read_error` on failure
- `renderTable(headers, rows, emptyMessage?)` — optional empty-state string argument; removes per-renderer early-return checks
- `parseLimitOpt(raw, globalOpts)` + `buildPaginationOpts(limit, after?, before?)` — shared pagination validation used by all `list` commands
- `confirmDelete(name, yes, globalOpts)` — shared confirmation guard for all `delete` commands
- `GlobalOpts` exported from `src/lib/client.ts` as the canonical type for action callbacks

**Test coverage**

- 80+ tests covering all new namespaces (domains, api-keys, broadcasts, contacts) and library helpers
- Shared test utilities (`ExitError`, `setNonInteractive`, `mockExitThrow`) extracted to `tests/helpers.ts`

### Fixed

- `isInteractive()` now checks both `process.stdin.isTTY` and `process.stdout.isTTY`; previously missed stdin which caused incorrect interactive detection in CI
- `domains delete` now returns `{ object: 'domain', id, deleted: true }` instead of the raw empty `{}` SDK response
- Windows browser open: corrected title argument and added a 5-second timeout

### Changed

- All `delete` commands synthesise a consistent `{ object, id, deleted: true }` response regardless of SDK return value
- Limit parsing now happens before spinner creation so `outputError` can exit cleanly without orphaning a running spinner
- `--help` text improved across all commands with flag descriptions, output shape, error codes, and usage examples

---

## [0.1.0] - 2026-02-18

### Added

- Initial release
- `resend auth login` — store API key in `~/.config/resend/credentials.json`
- `resend emails send` — send a single email (interactive and non-interactive modes)
- `resend doctor` — check authentication and API reachability
- `--api-key`, `--json` global flags; auto-JSON when stdout is not a TTY
- Cross-platform binary builds via GitHub Actions (darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64)
- PowerShell installer for Windows; hardened `install.sh` for Unix
