# Changelog

## [0.2.0] - 2026-02-18

### Added

- `resend domains` — create, verify, get, list, update, delete sending domains
- `resend api-keys` — create, list, delete API keys
- `resend broadcasts` — full broadcast lifecycle (create, send, get, list, update, delete)
- `resend contacts` — manage contacts, segments, and topics across all CRUD operations
- `resend emails batch` — send up to 100 emails in a single request from a JSON file
- Shared pagination (`--limit`, `--after`, `--before`) on all list commands
- `--html-file` flag on `emails send` and `broadcasts create` to read body from a file

### Fixed

- `isInteractive()` now checks both `stdin` and `stdout` TTY — CI environments are correctly detected as non-interactive
- `domains delete` now returns a consistent `{ id, deleted: true }` object instead of an empty `{}`

### Changed

- All delete commands return a uniform `{ object, id, deleted: true }` response
- `--help` improved across all commands with output shape, error codes, and usage examples

---

## [0.1.0] - 2026-02-18

- Initial release: `auth login`, `emails send`, `doctor`
- Auto JSON output when stdout is not a TTY (`--json`)
- Cross-platform binaries for macOS, Linux, and Windows via GitHub Actions
