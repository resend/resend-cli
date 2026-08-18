# careers

Detailed flag specifications for `resend careers` commands — browse open positions at Resend and submit job applications from the terminal.

Any valid Resend API key works; applications are not tied to the key's team.

---

## careers list

List open positions (default subcommand: bare `resend careers` runs this). Fetched live from Resend's applicant tracking system — no pagination.

No flags.

**Output:**
```json
{"object":"list","data":[{"id":"<id>","title":"<title>","department":"<department>","team":"<team>","location":"<location>","employment_type":"<type>","workplace_type":"<type>","published_at":"<date>"}]}
```

---

## careers apply

Submit a job application as multipart form data.

**Argument:** `<id>` — Job posting ID (required in non-interactive mode)

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Applicant's full name |
| `--email <email>` | string | Yes (non-interactive) | Applicant's email address |
| `--resume <path>` | string | Yes (non-interactive) | Path to a local resume file (PDF recommended, max 10MB) |
| `--field <path=value>` | string | No | Answer to a job-specific question; repeatable. Paths are shown on the job posting page at resend.com/careers, or via `GET /careers/<id>` (system fields use `name`/`email`/`resume`; job-specific questions use UUID paths) |
| `--yes` | boolean | No | Skip the confirmation prompt (interactive mode only) |

Interactive mode walks through every question in the job's application form; flags pre-fill their matching questions. Non-interactive mode submits exactly what the flags provide — required job-specific questions missing from `--field` are rejected by the API with a `validation_error`.

**Output:** `{"success":true}`

**Notes:**
- Applying twice with the same email fails with `apply_error` ("An application has already been submitted...").
- The resume is required by the API for every position.

**Example (non-interactive):**
```bash
resend careers apply <id> \
  --name "Ada Lovelace" \
  --email ada@example.com \
  --resume ./resume.pdf \
  --field '<uuid>=Because I love email infrastructure.'
```
