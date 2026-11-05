# auth & utility

Detailed flag specifications for `resend auth` and utility commands.

---

## auth login

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--web` | boolean | No | Log in through the browser with no prompts. Cannot be combined with `--key` |
| `--key <key>` | string | Yes (non-interactive, unless `--web`) | API key (must start with `re_`) |

Pass the key from an environment variable (e.g. `--key "$RESEND_API_KEY"`) or a secret manager — never as a literal, which would persist in shell history and logs.

When no key is available, use `--web`. The command prints an authorize URL to stderr, then waits up to 5 minutes for the user to approve it in the browser. Run it in the background, or with a timeout above 5 minutes. Show the user the URL and ask them to approve the login. The browser must run on the same machine as the CLI.

---

## auth logout

Removes the active profile's credentials (or all profiles if no `--profile`).

---

## auth list

Lists all profiles with active marker.

---

## auth switch

**Argument:** `[name]` — Profile name (prompts in interactive if omitted)

---

## auth rename

**Arguments:** `[old-name]` `[new-name]` — Prompts in interactive if omitted

---

## auth remove

**Argument:** `[name]` — Profile name (prompts in interactive if omitted)

---

## whoami

No flags. Shows authentication status (local only, no network calls).

---

## doctor

Checks: CLI Version, API Key, Domains, AI Agents.

Exits `0` if all pass/warn, `1` if any fail.

---

## update

Checks GitHub releases for newer version. Shows upgrade command.

---

## open

Opens `https://resend.com/emails` in the default browser.

`broadcasts` and `templates` also have their own `open` subcommands:
- `resend broadcasts open [id]` — open a broadcast or the broadcasts list
- `resend templates open [id]` — open a template or the templates list
