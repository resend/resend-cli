# auth & utility

Detailed flag specifications for `resend auth` and utility commands.

---

## auth login

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--key <key>` | string | Yes (non-interactive) | API key (must start with `re_`) |

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
