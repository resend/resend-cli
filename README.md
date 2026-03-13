# Resend CLI

The official CLI for [Resend](https://resend.com).

Built for humans, AI agents, and CI/CD pipelines.

```
██████╗ ███████╗███████╗███████╗███╗   ██╗██████╗
██╔══██╗██╔════╝██╔════╝██╔════╝████╗  ██║██╔══██╗
██████╔╝█████╗  ███████╗█████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██╔══╝  ╚════██║██╔══╝  ██║╚██╗██║██║  ██║
██║  ██║███████╗███████║███████╗██║ ╚████║██████╔╝
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝
```

## Install

### cURL

```sh
curl -fsSL https://resend.com/install.sh | bash
```

### Node.js

```sh
npm install -g resend-cli
```

### Homebrew (macOS / Linux)

```sh
brew install resend/cli/resend
```

### PowerShell (Windows)

```sh
irm https://resend.com/install.ps1 | iex
```

Or download the `.exe` directly from the [GitHub releases page](https://github.com/resend/resend-cli/releases/latest).

## Local development

Use this when you want to change the CLI and run your build locally.

### Prerequisites

- [Node.js](https://nodejs.org) 20+

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/resend/resend-cli.git
   cd resend-cli
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build locally**

   ```bash
   pnpm build
   ```

   Output: `./dist/cli.cjs`

### Running the CLI locally

Use the dev script:

```bash
pnpm dev -- --version
```

Or run the built JS bundle:

```bash
node dist/cli.cjs --version
```

### Making changes

After editing source files, rebuild:

```bash
pnpm build
```

### Building native binaries

To build a standalone native binary:

```bash
pnpm build:bin
```

Output: `./dist/resend`

## Quick start

```bash
# Authenticate
resend login

# Send an email
resend emails send \
  --from "you@yourdomain.com" \
  --to recipient@example.com \
  --subject "Hello from Resend CLI" \
  --text "Sent from my terminal."

# Check your environment
resend doctor
```

---

## Authentication

The CLI resolves your API key using the following priority chain:

| Priority | Source | How to set |
|----------|--------|------------|
| 1 (highest) | `--api-key` flag | `resend --api-key re_xxx emails send ...` |
| 2 | `RESEND_API_KEY` env var | `export RESEND_API_KEY=re_xxx` |
| 3 (lowest) | Config file | `resend login` |

If no key is found from any source, the CLI errors with code `auth_error`.

---

## Commands

### `resend login`

Authenticate by storing your API key locally. The key is validated against the Resend API before being saved.

```bash
resend login
```

#### Interactive mode (default in terminals)

When run in a terminal, the command checks for an existing key:

- **No key found** — Offers to open the [Resend API keys dashboard](https://resend.com/api-keys) in your browser so you can create one, then prompts for the key.
- **Existing key found** — Shows the key source (`env`, `config`) and prompts for a new key to replace it.

The key is entered via a masked password input and must start with `re_`.

#### Non-interactive mode (CI, pipes, scripts)

When stdin is not a TTY, the `--key` flag is required:

```bash
resend login --key re_xxxxxxxxxxxxx
```

Omitting `--key` in non-interactive mode exits with error code `missing_key`.

#### Options

| Flag | Description |
|------|-------------|
| `--key <key>` | API key to store (required in non-interactive mode) |

#### Output

On success, credentials are saved to `~/.config/resend/credentials.json` with `0600` permissions (owner read/write only). The config directory is created with `0700` permissions.

```bash
# JSON output
resend login --key re_xxx --json
# => {"success":true,"config_path":"/Users/you/.config/resend/credentials.json"}
```

#### Error codes

| Code | Cause |
|------|-------|
| `missing_key` | No `--key` provided in non-interactive mode |
| `invalid_key_format` | Key does not start with `re_` |
| `validation_failed` | Resend API rejected the key |

---

### `resend emails send`

Send an email via the Resend API. Provide all options via flags for scripting, or let the CLI prompt interactively for missing fields.

```bash
resend emails send \
  --from "Name <sender@yourdomain.com>" \
  --to recipient@example.com \
  --subject "Subject line" \
  --text "Plain text body"
```

#### Options

| Flag | Required | Description |
|------|----------|-------------|
| `--from <address>` | Yes | Sender email address (must be from a verified domain) |
| `--to <addresses...>` | Yes | One or more recipient email addresses (space-separated) |
| `--subject <subject>` | Yes | Email subject line |
| `--text <text>` | One of text/html/html-file | Plain text body |
| `--html <html>` | One of text/html/html-file | HTML body as a string |
| `--html-file <path>` | One of text/html/html-file | Path to an HTML file to use as body |
| `--cc <addresses...>` | No | CC recipients (space-separated) |
| `--bcc <addresses...>` | No | BCC recipients (space-separated) |
| `--reply-to <address>` | No | Reply-to email address |

#### Interactive mode

When run in a terminal without all required flags, the CLI prompts for missing fields:

```bash
# prompts for from, to, subject, and body
resend emails send

# prompts only for missing fields
resend emails send --from "you@yourdomain.com"
```

#### Non-interactive mode

When piped or run in CI, all required flags must be provided. Missing flags cause an error listing what's needed:

```bash
echo "" | resend emails send --from "you@yourdomain.com"
# Error: Missing required flags: --to, --subject
```

A body (`--text`, `--html`, or `--html-file`) is also required — omitting all three exits with code `missing_body`.

#### Examples

**Multiple recipients:**

```bash
resend emails send \
  --from "you@yourdomain.com" \
  --to alice@example.com bob@example.com \
  --subject "Team update" \
  --text "Hello everyone"
```

**HTML from a file:**

```bash
resend emails send \
  --from "you@yourdomain.com" \
  --to recipient@example.com \
  --subject "Newsletter" \
  --html-file ./newsletter.html
```

**With CC, BCC, and reply-to:**

```bash
resend emails send \
  --from "you@yourdomain.com" \
  --to recipient@example.com \
  --subject "Meeting notes" \
  --text "See attached." \
  --cc manager@example.com \
  --bcc archive@example.com \
  --reply-to noreply@example.com
```

**Overriding the API key for one send:**

```bash
resend --api-key re_other_key emails send \
  --from "you@yourdomain.com" \
  --to recipient@example.com \
  --subject "Test" \
  --text "Using a different key"
```

#### Output

Returns the email ID on success:

```json
{ "id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }
```

#### Error codes

| Code | Cause |
|------|-------|
| `auth_error` | No API key found or client creation failed |
| `missing_body` | No `--text`, `--html`, or `--html-file` provided |
| `file_read_error` | Could not read the file passed to `--html-file` |
| `send_error` | Resend API returned an error |

---

### `resend doctor`

Run environment diagnostics. Verifies your CLI version, API key, domains, and detects AI agent integrations.

```bash
resend doctor
```

#### Checks performed

| Check | Pass | Warn | Fail |
|-------|------|------|------|
| **CLI Version** | Running latest | Update available or registry unreachable | — |
| **API Key** | Key found (shows masked key + source) | — | No key found |
| **Domains** | Verified domains exist | No domains or all pending verification | API key invalid |
| **AI Agents** | Lists detected agents (or none) | — | — |

The API key is always masked in output (e.g. `re_...xxxx`).

#### Interactive mode

In a terminal, shows animated spinners for each check with colored status icons:

```
  Resend Doctor

  ✔ CLI Version: v0.1.0 (latest)
  ✔ API Key: re_...xxxx (source: env)
  ✔ Domains: 2 verified, 0 pending
  ✔ AI Agents: Detected: Cursor, Claude Desktop
```

#### JSON mode

```bash
resend doctor --json
```

```json
{
  "ok": true,
  "checks": [
    { "name": "CLI Version", "status": "pass", "message": "v0.1.0 (latest)" },
    { "name": "API Key", "status": "pass", "message": "re_...xxxx (source: env)" },
    { "name": "Domains", "status": "pass", "message": "2 verified, 0 pending" },
    { "name": "AI Agents", "status": "pass", "message": "Detected: Cursor" }
  ]
}
```

Each check has a `status` of `pass`, `warn`, or `fail`. The top-level `ok` is `false` if any check is `fail`.

#### Detected AI agents

| Agent | Detection method |
|-------|-----------------|
| OpenClaw | `~/clawd/skills` directory exists |
| Cursor | `~/.cursor` directory exists |
| Claude Desktop | Platform-specific config file exists |
| VS Code | `.vscode/mcp.json` in current directory |

#### Exit code

Exits `0` when all checks pass or warn. Exits `1` if any check fails.

---

## Global options

These flags work on every command and are passed before the subcommand:

```bash
resend [global options] <command> [command options]
```

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key for this invocation (takes highest priority) |
| `--profile <name>` | Profile to use (overrides `RESEND_PROFILE` env var) |
| `--json` | Force JSON output even in interactive terminals |
| `-q, --quiet` | Suppress spinners and status output (implies `--json`) |
| `--version` | Print version and exit |
| `--help` | Show help text |

---

## Output behavior

The CLI has two output modes:

| Mode | When | Stdout | Stderr |
|------|------|--------|--------|
| **Interactive** | Terminal (TTY) | Formatted text | Spinners, prompts |
| **Machine** | Piped, CI, or `--json` | JSON | Nothing |

Switching is automatic — pipe to another command and JSON output activates:

```bash
resend doctor | jq '.checks[].name'
resend emails send --from ... --to ... --subject ... --text ... | jq '.id'
```

### Error output

Errors always exit with code `1` and output structured JSON to stdout:

```json
{ "error": { "message": "No API key found", "code": "auth_error" } }
```

---

## Agent & CI/CD usage

### CI/CD

Set `RESEND_API_KEY` as an environment variable — no `resend login` needed:

```yaml
# GitHub Actions
env:
  RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
steps:
  - run: |
      resend emails send \
        --from "deploy@yourdomain.com" \
        --to "team@yourdomain.com" \
        --subject "Deploy complete" \
        --text "Version ${{ github.sha }} deployed."
```

### AI agents

Agents calling the CLI as a subprocess automatically get JSON output (non-TTY detection). The contract:

- **Input:** All required flags must be provided (no interactive prompts)
- **Output:** JSON to stdout, nothing to stderr
- **Exit code:** `0` success, `1` error
- **Errors:** Always include `message` and `code` fields

---

## Configuration

| Item | Path | Notes |
|------|------|-------|
| Config directory | `~/.config/resend/` | Respects `$XDG_CONFIG_HOME` on Linux, `%APPDATA%` on Windows |
| Credentials | `~/.config/resend/credentials.json` | `0600` permissions (owner read/write) |
| Install directory | `~/.resend/bin/` | Respects `$RESEND_INSTALL` |

## License

MIT
