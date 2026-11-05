# auth & utility

Detailed flag specifications for `resend auth` and utility commands.

---

## auth login

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--web` | boolean | No | Log in through the browser with no prompts. Cannot be combined with `--key` |
| `--key <key>` | string | Yes (non-interactive, unless `--web`) | API key (must start with `re_`) |

Pass the key from an environment variable (e.g. `--key "$RESEND_API_KEY"`) or a secret manager — never as a literal, which would persist in shell history and logs.

When no key is available, use `--web`:

1. Run `resend auth list`. If a profile is active, pass `--profile <name>`, so the login lands where later commands read it. Without `--profile`, the login replaces the `default` profile.
2. Start `resend login --web` in the background, or with a timeout of at least 6 minutes. It blocks for up to 5 minutes while it waits, then exchanges the code.
3. Read the authorize URL from stderr. Show it to the user and ask them to approve the login.
4. Wait for the command to exit. On success, stdout holds the result.

stderr holds plain status text before any JSON error, so parse only the last JSON object on stderr. The browser must run on the same machine as the CLI. On a remote host, use `--key` instead.

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
