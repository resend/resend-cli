# Agent DX Gap Analysis

Gap analysis of the Resend CLI against the 7 dimensions from
["You Need to Rewrite Your CLI for AI Agents"](https://justinpoehnelt.com/rewrite-your-cli-for-agents/)
by Justin Poehnelt (Google).

---

## 1. Structured Output

> Agents need machine-readable output — JSON by default when piped.

### Strengths

- **Auto-JSON when piped.** `shouldOutputJson()` returns `true` when `!process.stdout.isTTY` (`src/lib/output.ts:14`). Every command goes through `outputResult` / `outputError`, so piped output is always JSON with zero flags required.
- **Consistent error envelope.** `outputError` emits `{"error":{"message":"…","code":"…"}}` with exit code 1 (`src/lib/output.ts:35-54`).
- **Help text documents the JSON shape.** `buildHelpText` includes an `output` section and `errorCodes` list (`src/lib/help-text.ts:1-34`).

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| No `--output` format flag | Only `--json` exists. No `--output=yaml`, `--output=csv`, or `--output=table`. | Low priority — JSON is sufficient for agents. Consider adding `--output` only if human table formatting is needed. |
| No JSON-Lines streaming | List endpoints return a single JSON blob. For large result sets an agent can't stream-process rows. | Add optional `--jsonl` or newline-delimited mode to `runList`. |

---

## 2. Deterministic, Non-Interactive Behavior

> When piped, CLIs must never prompt — they should fail fast with an actionable error.

### Strengths

- **TTY detection is solid.** `isInteractive()` checks `stdin.isTTY`, `stdout.isTTY`, `CI`, `GITHUB_ACTIONS`, and `TERM=dumb` (`src/lib/tty.ts:1-15`).
- **Missing flags → structured error.** `promptForMissing` exits with `missing_flags` code and lists which flags are needed (`src/lib/prompts.ts:55-61`).
- **Delete confirmation → structured error.** `confirmDelete` exits with `confirmation_required` and tells the agent to pass `--yes` (`src/lib/prompts.ts:28-36`).
- **Spinner is a no-op.** `createSpinner` returns stub methods in non-interactive mode (`src/lib/spinner.ts:48-55`).

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| `setup` command has no non-interactive default | Bare `resend setup` errors with `missing_target` when piped — the agent must already know the valid targets (`src/commands/setup/index.ts:70-79`). | Consider an `--all` flag or `resend setup --target cursor,vscode` to let agents configure multiple targets in one call. |
| `skills install` shells out to `npx skills` in TTY | Interactive path delegates to an external process (`src/commands/skills/install.ts:231-246`). If TTY detection is wrong, the agent gets an interactive subprocess. | The non-interactive path already exists and works — just ensure the interactive branch can never trigger when `--json` is passed (currently it can't, but worth a guard). |

---

## 3. Meaningful Exit Codes

> Agents rely on exit codes to branch logic. 0 = success, non-zero = specific failure category.

### Strengths

- **Errors exit 1.** `outputError` defaults to exit code 1 (`src/lib/output.ts:39`).
- **Error codes in JSON.** The `code` field (`missing_flags`, `auth_error`, `fetch_error`, etc.) lets agents distinguish failure types without parsing messages.

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| Single exit code for all errors | Everything exits 1. Auth failures, validation errors, network errors, and 404s are indistinguishable by exit code alone. | Define a small set of exit codes: `1` = general, `2` = usage/validation, `3` = auth, `4` = network/API, `78` = config. Map `outputError` codes to exit codes. |
| `process.exit(0)` on cancel | `cancelAndExit` exits 0 (`src/lib/prompts.ts:14-17`). A cancelled operation should exit non-zero so agents don't interpret it as success. | Exit 130 (standard SIGINT convention) or a dedicated code on cancellation. |

---

## 4. Stderr vs Stdout Separation

> Machines read stdout. Humans read stderr. Progress, spinners, and status go to stderr.

### Strengths

- **Spinners write to stderr.** All spinner output uses `process.stderr.write` (`src/lib/spinner.ts:62-80`).
- **Error JSON goes to stderr.** `outputError` uses `console.error` for JSON errors (`src/lib/output.ts:42`).

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| Interactive success messages go to stdout | `console.log(config.successMsg)` in `runDelete`, `runWrite`, and setup commands writes human text to stdout (`src/lib/actions.ts:67,124`). If an agent accidentally gets the interactive branch, it mixes human text with machine output. | Route all non-JSON human messages through `console.error` (stderr) so stdout is always machine-parseable. |
| `skills install` interactive output on stdout | `console.log('  ✔ ...')` in `installSkills` goes to stdout (`src/commands/skills/install.ts:173-178`). | Move to stderr. |

---

## 5. Discoverability & Self-Documentation

> Agents need to understand what a CLI can do from the CLI itself — not from docs websites.

### Strengths

- **Rich help text.** `buildHelpText` adds output shape, error codes, and examples to every command (`src/lib/help-text.ts`).
- **Examples are runnable.** Help text examples use real `$ resend ...` invocations.
- **MCP setup exists.** `resend setup` configures the CLI as an MCP server for 5 agents (`src/commands/setup/index.ts`).

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| No machine-readable command tree | `--help` outputs human-formatted text. There's no `resend --help --json` or `resend commands --json` that returns a structured list of all commands, flags, and types. | Add a hidden `resend commands` (or `--help --json`) that outputs the full command tree as JSON — subcommands, flags, types, defaults, required/optional. This is the single highest-impact improvement for agent discoverability. |
| No schema per command | Agents guess at flag types and constraints. | Emit JSON Schema for each command's input (flags + args) and output shape. Could be auto-generated from Commander metadata. |
| No version/capability negotiation | No `resend capabilities` or feature flags. An agent can't check if a subcommand exists without running it. | Add `resend capabilities --json` returning supported commands and API version. |

---

## 6. Auth & Configuration

> Agents need non-interactive auth: env vars, config files, or flags — never browser OAuth flows.

### Strengths

- **Three-tier key resolution.** `resolveApiKey` checks `--api-key` flag → `RESEND_API_KEY` env → `~/.config/resend/credentials.json` (`src/lib/config.ts:24-45`). All three work without interaction.
- **Config file is secure.** Written with `0o600` permissions (`src/lib/config.ts:52-59`).
- **XDG-compliant.** Respects `XDG_CONFIG_HOME` and `APPDATA` (`src/lib/config.ts:14-22`).

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| No auth status command | There's no way to verify auth works without making an API call. | Add `resend auth status --json` → `{"authenticated":true,"source":"env","key_prefix":"re_..."}`. Useful for agents to pre-flight check credentials. |
| No key scoping info | The CLI doesn't surface whether the key is a full-access or sending-only key. | Return key metadata (permissions, team) from a status endpoint if the API supports it. |
| `resend login` is interactive-only | If `resend login` exists and requires TTY input, agents can't use it. | Ensure `resend login --api-key <key>` works non-interactively (just stores the key). |

---

## 7. Idempotency & Safety

> Agent retries are inevitable. Commands should be safe to re-run.

### Strengths

- **Setup commands are idempotent.** `mergeJsonConfig` reads existing config and merges — running twice produces the same result (`src/commands/setup/utils.ts:14-33`). Help text documents this.
- **Skills install is idempotent.** Files are overwritten with the same content.
- **Delete requires `--yes`.** Prevents accidental destructive actions in non-interactive mode (`src/lib/prompts.ts:28-36`).

### Gaps

| Gap | Details | Recommendation |
|-----|---------|----------------|
| No idempotency keys for create operations | `resend emails send` or `resend domains create` with the same args may create duplicates. | Support `--idempotency-key <key>` passed through to the API's `Idempotency-Key` header. Critical for agent retry loops. |
| No dry-run mode | No `--dry-run` flag to preview what a command would do. | Add `--dry-run` that validates inputs, resolves auth, and returns the request that *would* be made — without executing it. |
| File reads have no path validation | `readFile` in `src/lib/files.ts` reads any path the process can access. An agent could be tricked into reading sensitive files. | Validate paths against an allowlist or working-directory scope. Low priority if the CLI is always invoked by a trusted agent. |

---

## Implementation Priority

Ordered by impact on agent usability:

| # | Item | Dimension | Effort |
|---|------|-----------|--------|
| 1 | `resend commands --json` — machine-readable command tree | Discoverability | Medium |
| 2 | Differentiated exit codes (2/3/4 by error category) | Exit Codes | Small |
| 3 | Route all human messages to stderr | Stderr/Stdout | Small |
| 4 | `resend auth status --json` | Auth | Small |
| 5 | `--idempotency-key` flag for create/send commands | Idempotency | Small |
| 6 | `--dry-run` flag | Idempotency | Medium |
| 7 | JSON Schema per command (input + output) | Discoverability | Large |
| 8 | `resend capabilities --json` | Discoverability | Medium |
| 9 | Cancel exits non-zero (130) | Exit Codes | Tiny |
| 10 | `--jsonl` streaming for list commands | Structured Output | Medium |

---

## Summary

The Resend CLI already handles the two most common agent pitfalls well: **structured output is automatic when piped**, and **interactive prompts fail fast with actionable errors**. The spinner, auth, and setup systems are agent-friendly out of the box.

The biggest gaps are in **discoverability** (no way for an agent to introspect available commands as JSON) and **exit code granularity** (everything is exit 1). Fixing items 1-4 above would cover ~80% of the agent DX surface with relatively small changes.
