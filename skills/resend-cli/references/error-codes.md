# Error Codes

All errors exit with code `1` and output JSON to **stderr**:

```json
{"error":{"message":"Human-readable description","code":"error_code"}}
```

## Authentication Errors

| Code | Cause | Resolution |
|------|-------|------------|
| `auth_error` | No API key found from any source | Set `RESEND_API_KEY` env, pass `--api-key`, or run `resend login --key re_xxx` |
| `missing_key` | `login` called non-interactively without `--key` | Pass `--key re_xxx` |
| `invalid_key_format` | API key does not start with `re_` | Use a valid Resend API key starting with `re_` |
| `validation_failed` | Resend API rejected the key during login | Verify the key exists and is active at resend.com/api-keys |

## Email Errors

| Code | Cause | Resolution |
|------|-------|------------|
| `missing_body` | None of `--text`, `--html`, `--html-file`, or `--react-email` provided | Provide at least one body flag |
| `react_email_build_error` | Failed to bundle a React Email `.tsx` template with esbuild | Check the template compiles; ensure `react` and one of `@react-email/render`, `@react-email/components`, or `react-email` are installed in the project |
| `react_email_render_error` | Bundled template failed during `render()` | Check the component exports a default function and renders valid React Email markup |
| `file_read_error` | Could not read file from `--html-file` path | Check file path exists and is readable |
| `send_error` | Resend API rejected the send request | Check from address is on a verified domain; check recipient is valid |

## Domain Errors

| Code | Cause | Resolution |
|------|-------|------------|
| `domain_error` | Domain creation, verification, or update failed | Check domain name is valid; check DNS records are configured |

## General Errors

| Code | Cause | Resolution |
|------|-------|------------|
| `unexpected_error` | Unhandled exception | Check CLI version with `resend update`; report at github.com/resend/resend-cli/issues |
| `unknown` | Error without a specific code | Inspect the `message` field for details |

## Troubleshooting

### "No API key found" in CI
Ensure `RESEND_API_KEY` is set in the environment. The CLI does not prompt in non-TTY mode.

### "Missing required flags" errors
In non-interactive mode (CI, piped, agent), ALL required flags must be provided. The CLI will not prompt.

### Deletion commands fail without `--yes`
All `delete`/`rm` subcommands require `--yes` in non-interactive mode to prevent accidental deletion.

### API rate limits
The Resend API has rate limits. If you hit them, the error message will indicate rate limiting. Add delays between batch operations.

### Scheduled email errors
`--scheduled-at` must be a valid ISO 8601 datetime. The scheduled time must be in the future.
