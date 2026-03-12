# CLI Building Best Practices

A comprehensive guide based on analysis of the best-rated developer CLIs (gh, Stripe, Vercel, Railway, Fly.io, Supabase, Wrangler) and current industry patterns.

---

## Table of Contents

1. [Best-in-Class CLIs and Their Killer Features](#1-best-in-class-clis-and-their-killer-features)
2. [Command Structure and Naming](#2-command-structure-and-naming)
3. [The Dual Interface: Humans + Agents](#3-the-dual-interface-humans--agents)
4. [UX Patterns](#4-ux-patterns)
5. [Error Handling](#5-error-handling)
6. [Authentication](#6-authentication)
7. [Configuration Hierarchy](#7-configuration-hierarchy)
8. [Output and Formatting](#8-output-and-formatting)
9. [Performance](#9-performance)
10. [Distribution and Updates](#10-distribution-and-updates)
11. [Frameworks and Libraries](#11-frameworks-and-libraries)
12. [The Do's and Don'ts](#12-the-dos-and-donts)
13. [Emerging Trends (2025)](#13-emerging-trends-2025)
14. [Design Principles](#14-design-principles)
15. [Testing Strategies](#15-testing-strategies)
16. [Security](#16-security)
17. [Plugin and Extension Architecture](#17-plugin-and-extension-architecture)
18. [Versioning and Backwards Compatibility](#18-versioning-and-backwards-compatibility)
19. [Documentation Patterns](#19-documentation-patterns)
20. [Telemetry and Analytics](#20-telemetry-and-analytics)
21. [Accessibility](#21-accessibility)

---

## 1. Best-in-Class CLIs and Their Killer Features

### GitHub CLI (`gh`) — The Gold Standard for API-Wrapping CLIs

- **Stack:** Go + Cobra + Glamour + go-gh extensions SDK
- **Killer features:**
  - Extensions system — community-built plugins via `gh extension install`
  - `gh api` — raw API access with baked-in auth
  - `--json` with `--jq` for inline field selection: `gh pr list --json number,title --jq '.[].title'`
  - Interactive mode fills in missing args (e.g., `gh pr create` walks you through title, body, reviewers)
  - Progressive disclosure — works for beginners (interactive) and power users (flags + JSON)

### Stripe CLI (`stripe`) — Best-in-Class for Developer Workflows

- **Stack:** Go + Cobra
- **Killer features:**
  - `stripe listen --forward-to` — forwards webhooks to local dev server (game-changer)
  - `stripe trigger` — fire test webhook events
  - `stripe logs tail` — real-time API log streaming
  - `stripe samples` — clone ready-to-use integration samples
  - Built-in API resource autocompletion

### Vercel CLI (`vercel`) — The "Just Works" CLI

- **Stack:** Node.js/TypeScript
- **Killer features:**
  - Zero-config: just run `vercel` in a project directory
  - Automatic framework detection (Next.js, Remix, Vite, etc.)
  - `vercel dev` mirrors production locally
  - `vercel link` for project association — subsequent commands "just know" the project

### Railway CLI (`railway`) — Ergonomic Cloud Operations

- **Stack:** Go
- **Killer features:**
  - `railway run` — run local commands with production env vars injected
  - `railway shell` — interactive shell with env vars loaded
  - Beautiful TUI for project/service selection

### Fly.io CLI (`fly`) — Full Infra from the Terminal

- **Stack:** Go + Cobra
- **Killer features:**
  - `fly launch` — detect, configure, and deploy in one step
  - `fly doctor` — self-diagnosis for configuration issues
  - `fly proxy` — tunnel to private services
  - Wireguard-based private networking from CLI

### Supabase CLI (`supabase`) — Local-First Development

- **Stack:** Go
- **Killer features:**
  - `supabase start` — full local stack (Postgres, Auth, Storage, Realtime)
  - `supabase db diff` — auto-generate migrations from schema changes
  - `supabase gen types` — TypeScript types from DB schema

### Common Threads

| Pattern | Who Does It |
|---------|------------|
| `<tool> login` + `<tool> whoami` | All of them |
| `--json` flag for machine output | gh, stripe, vercel, fly |
| Interactive prompts for missing args | gh, vercel, railway |
| `link` then operate pattern | vercel, railway, supabase |
| `doctor` self-diagnosis | fly, brew, resend |
| Browser-based OAuth login | gh, vercel, stripe |
| Extension/plugin system | gh, oclif-based CLIs |
| Update notifications | npm, vercel, most CLIs |

---

## 2. Command Structure and Naming

### Use noun-verb (resource-action) hierarchy

```
resend domains list          # not: resend list-domains
resend emails send           # not: resend send-email
gh pr create                 # not: gh create-pr
stripe customers list        # not: stripe list-customers
```

**Why:** Enables discoverability. Users think "I want to do something with domains" → type `resend domains` → see available actions. Subcommand grouping scales better than flat command lists.

### Provide aliases for common operations

```
resend domains list
resend domains ls            # alias
```

### Keep the command tree shallow

Aim for max 3 levels: `tool resource action`. Deeper nesting (e.g., `tool resource sub-resource action`) should be rare and well-justified.

### Flag naming conventions

- Use `--long-flags` with hyphens (not underscores)
- Provide single-letter shortcuts for frequent flags: `-q` for `--quiet`, `-v` for `--version`
- Boolean flags should be positive: `--json` not `--no-human`
- Consistent naming across all commands: `--limit`, `--after`, `--before` everywhere

---

## 3. The Dual Interface: Humans + Agents

Every modern CLI has two audiences: **humans at a terminal** and **machines** (scripts, CI pipelines, AI agents, MCP servers). The best CLIs serve both without compromise.

### Auto-detect and adapt

- **TTY detected** (interactive terminal): colors, spinners, tables, progress, confirmation prompts
- **Non-TTY** (piped, redirected, scripted): clean structured data (JSON), skip interactive elements, never block on input

```
# Human experience:
$ resend domains list
  ✔ Domains fetched
  NAME              STATUS     REGION
  example.com       verified   us-east-1
  test.io           pending    eu-west-1

# Machine experience (piped):
$ resend domains list | jq '.data[].name'
"example.com"
"test.io"
```

### Non-interactive mode is mandatory

AI agents cannot type into prompts. Every CLI must:

- Accept all inputs as flags/arguments (no mandatory prompts)
- Provide `--yes` / `-y` / `--force` to skip confirmations
- Provide `--quiet` / `-q` to suppress progress output
- Detect `CI=true`, `GITHUB_ACTIONS`, `NO_COLOR`, `TERM=dumb` as signals to disable interactivity

### Structured output as a first-class API contract

```json
// Success envelope
{"object": "list", "data": [...], "has_more": true}

// Error envelope — always the same shape
{"error": {"message": "...", "code": "..."}}
```

- Consistent envelope across all commands
- Stable field names across versions (treat JSON output as a versioned API)
- Exit codes carry meaning: `0` = success, `1` = error, `2` = usage error

### Composability (Unix Philosophy)

```bash
# Agent-composed pipeline
resend domains list --json | jq -r '.data[].id' | xargs -I {} resend domains verify {}
```

- **One command, one action**
- **Pipeable output:** JSON on stdout → `jq`, `xargs`, next command
- **Stdin acceptance:** e.g., `resend emails send --body -` reads from stdin
- **Idempotent reads:** GET/LIST operations safe to retry

### MCP-Readiness Checklist

CLIs are natural candidates for Model Context Protocol (MCP) server wrapping. What makes a CLI "MCP-ready":

1. Every command has `--json` output
2. Every command can run non-interactively (all params via flags)
3. Error responses are structured and consistent
4. Commands are discoverable (good `--help` with descriptions)
5. Authentication via environment variable (not just interactive login)
6. Consider a `schema` subcommand that outputs the full command tree as JSON

### Discoverability for agents

- **`--help` quality directly impacts how well an agent uses your tool** — agents parse help text
- **Examples in help text** — agents learn usage patterns from examples
- **Consistent option naming** — `--limit`, `--after`, `--before` everywhere
- **Emerging pattern — `--help --json`:**

```json
{
  "name": "domains list",
  "description": "List all domains",
  "options": [
    {"name": "--limit", "type": "number", "default": 10},
    {"name": "--after", "type": "string"}
  ]
}
```

---

## 4. UX Patterns

### Colors and Styling

| Color | Meaning |
|-------|---------|
| Green | Success |
| Red | Error |
| Yellow | Warning |
| Cyan/Blue | Info, links |
| Bold | Emphasis (command names, important values) |
| Dim/Gray | Secondary info (timestamps, IDs, hints) |

**Rules:**
- Respect `NO_COLOR` environment variable ([no-color.org](https://no-color.org))
- Detect TTY: colors when interactive, plain text when piped
- Never use color as the *only* signal — pair with symbols (`✔`, `✗`, `⚠`)

### Spinners and Progress

- **Spinners** for indeterminate operations (API calls, deployments)
- **Progress bars** for determinate operations (file uploads, downloads)
- Write spinners to **stderr**, never stdout — keeps machine output clean

```
  ⣹ Fetching domains...     → stderr
  ✔ Domains fetched          → stderr
  {"data": [...]}            → stdout (only when piped/--json)
```

### Interactive Prompts

- Selection lists with arrow-key navigation
- Multi-select with checkboxes
- Text input with validation
- Confirmation prompts (`y/N`) for destructive actions
- **Always provide flag alternatives** so prompts can be skipped

### Tables

- Aligned columns for list output
- Truncate long values with ellipsis
- Show row count and pagination hints
- Consider terminal width — responsive truncation

---

## 5. Error Handling

### The Three-Part Error Message

Every error should contain:

1. **What went wrong** (plain language)
2. **What the user can do about it** (actionable suggestion)
3. **Where to get more help** (docs link or `--help`)

```
Error: No webhook endpoint found for event `payment_intent.created`

  To start listening for webhooks, run:
    stripe listen --forward-to localhost:3000/webhook

  For more info, see: https://stripe.com/docs/webhooks
```

### Error handling rules

- **Exit codes:** `0` success, `1` general error, `2` usage error
- **stderr for errors, stdout for data** — so piping works
- **Typo suggestions:** "Did you mean `deploy`?" (Levenshtein distance)
- **Context-aware:** "You're not logged in. Run `resend login` first."
- **Never show raw stack traces** to end users
- **Verbose mode:** `--verbose` / `-v` for debug output, hidden by default

### Structured errors for machines

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": "rate_limit",
    "retryable": true,
    "retry_after": 5,
    "suggestion": "Wait 5 seconds and try again"
  }
}
```

---

## 6. Authentication

### The priority chain

```
--api-key flag       (highest — per-invocation)
  ↓
RESEND_API_KEY env   (per-session/environment)
  ↓
~/.config/resend/    (persistent — set up once interactively)
  ↓
Interactive login    (lowest — fallback)
```

This is the gold standard. `gh` (GH_TOKEN), `aws` (AWS_ACCESS_KEY_ID), `stripe` (STRIPE_API_KEY) all follow this pattern. The env var layer is critical for AI agents and CI.

### Auth UX patterns

- `<tool> login` — browser-based OAuth flow, opens browser automatically
- `<tool> whoami` — verify current authentication
- `<tool> logout` — clear stored credentials
- Token stored securely (keychain or XDG config file)
- Show which auth method is in use when `--verbose`

---

## 7. Configuration Hierarchy

```
Flags          (highest priority — explicit per-invocation)
  ↓
Environment    (RESEND_API_KEY, RESEND_TEAM)
  ↓
Project config (.resend/ in project directory)
  ↓
Global config  (~/.config/resend/)
  ↓
Defaults       (lowest priority)
```

### Config file best practices

- Follow XDG Base Directory spec: `~/.config/<tool>/` for config, `~/.cache/<tool>/` for cache
- Use well-known formats: JSON, TOML, or YAML
- Document all config options in help text
- Provide `config set`/`config get` commands for common options

---

## 8. Output and Formatting

### The output format spectrum

| Level | Flag | Agent Friendliness | Example |
|-------|------|-------------------|---------|
| Basic | `--json` | Good | Most CLIs |
| Medium | `--format json\|table\|csv` | Better | Some CLIs |
| Advanced | `--json --jq '.data[].id'` | Best | gh CLI |
| Full | `-o jsonpath='{.items[*]}'` | Best | kubectl |

### Best practices

- Human-readable tables by default (interactive)
- JSON when `--json` flag or non-TTY
- `--quiet` suppresses all non-essential output (implies `--json` in piped contexts)
- Consider `--jq` for inline filtering (eliminates external `jq` dependency)

---

## 9. Performance

### Startup time matters

Users notice CLI startup time. Targets:

- **< 100ms** — feels instant (Go, Rust CLIs)
- **100-300ms** — acceptable (well-optimized Node.js)
- **> 500ms** — feels sluggish
- **> 1s** — users will complain

### Tips

- Lazy-load dependencies — don't load the entire SDK for `--help`
- Bundle and tree-shake (esbuild for Node.js)
- Avoid unnecessary network calls on startup
- Cache API responses locally when appropriate
- Run update checks asynchronously (don't block the command)

---

## 10. Distribution and Updates

### Distribution strategies

| Method | Pros | Cons |
|--------|------|------|
| npm (`npx resend`) | Easy install, auto-updates | Requires Node.js |
| Homebrew | Native feel on macOS | macOS/Linux only |
| Binary releases (GitHub) | No runtime needed | Manual updates |
| pkg / bun compile | Single binary from Node.js | Larger binary size |
| Docker | Isolated, reproducible | Heavy for simple CLIs |

### Update notifications

- Check for updates **asynchronously** after command execution (don't slow down the command)
- Show a non-intrusive message: "Update available: 1.2.1 → 1.3.0. Run `npm update -g resend-cli`"
- Cache the check result (e.g., for 24 hours)
- Respect `--quiet` and non-interactive modes (suppress update messages)

---

## 11. Frameworks and Libraries

### Node.js/TypeScript (current Resend CLI stack)

| Concern | Library | Notes |
|---------|---------|-------|
| Argument parsing | **Commander.js** | Most popular, well-typed with `@commander-js/extra-typings` |
| Interactive prompts | **@clack/prompts** | Modern, beautiful — used by create-astro, create-svelte |
| Spinners | Custom or **ora** | Writing to stderr is critical |
| Colors | **picocolors** (tiny) or **chalk** | picocolors is 14x smaller |
| Tables | Custom column formatting | Keep it simple |
| JSON output | Built-in `--json` flag | Standard pattern |
| Update checks | Custom or **update-notifier** | Must be async |
| Bundling | **esbuild** | Fast, tree-shakes well |
| Binary builds | **@yao-pkg/pkg** | Single binary from Node.js |
| Testing | **vitest** | Fast, TypeScript-native |

### Go (most popular for production CLIs)

| Concern | Library | Used By |
|---------|---------|---------|
| Framework | **Cobra** | gh, kubectl, docker, stripe, fly |
| Config | **Viper** | Often paired with Cobra |
| TUI | **Bubble Tea** (Charm) | Elm-architecture TUI framework |
| Styling | **Lip Gloss** (Charm) | CSS-like terminal styling |
| Prompts | **Huh** (Charm) | Beautiful form/prompt library |
| Markdown | **Glamour** (Charm) | Terminal markdown rendering |

### Rust (growing fast)

| Concern | Library | Notes |
|---------|---------|-------|
| Args | **clap** | Derive macros for declarative CLI definition |
| TUI | **ratatui** | Successor to tui-rs |
| Progress | **indicatif** | Progress bars and spinners |
| Prompts | **dialoguer** | Interactive prompts |
| Styling | **console** | Terminal styling |

---

## 12. The Do's and Don'ts

### Do's

- **Do** detect TTY and adapt output (colors, JSON, prompts)
- **Do** respect `NO_COLOR`, `CI`, `TERM=dumb`
- **Do** provide `--json` on every command
- **Do** write spinners/progress to stderr, data to stdout
- **Do** include examples in every `--help` text
- **Do** provide sensible defaults — minimize required flags
- **Do** use consistent flag naming across all commands
- **Do** show actionable error messages with fix suggestions
- **Do** support `--quiet` mode for CI/scripting
- **Do** offer tab completion (shell completions)
- **Do** cache API responses when appropriate
- **Do** run update checks asynchronously
- **Do** confirm before destructive actions (delete, overwrite)
- **Do** provide a `doctor` command for self-diagnosis
- **Do** document the config hierarchy (flags > env > config > defaults)
- **Do** make every action achievable without interactive prompts (flag alternatives)

### Don'ts

- **Don't** require interactive input with no flag alternative
- **Don't** show raw stack traces to users
- **Don't** block startup with network calls (update checks, analytics)
- **Don't** use color as the only signal (pair with symbols)
- **Don't** break JSON output format between versions (it's an API)
- **Don't** mix data and progress on stdout (use stderr for progress)
- **Don't** force users to remember argument order — prefer named flags
- **Don't** output secrets/tokens in plain text by default
- **Don't** use opt-out telemetry without clear disclosure
- **Don't** ignore terminal width — truncate tables responsively
- **Don't** make `--help` slow (lazy-load heavy dependencies)
- **Don't** use inconsistent naming (e.g., `--output` in one command, `--format` in another)
- **Don't** fail silently — always communicate what happened
- **Don't** require global installation for one-off use (support `npx`)
- **Don't** forget Windows — test path handling, terminal capabilities, and line endings

---

## 13. Emerging Trends (2025)

### AI integration in CLIs

- GitHub Copilot in CLI, Warp AI, Amazon Q CLI (formerly Fig)
- Natural language → command translation
- AI-powered error suggestions

### Rust rewrites

- Many tools moving from Go/Node to Rust for performance
- Turborepo (Go → Rust), Biome (replaces Prettier/ESLint), oxlint

### Single-binary distribution

- Node.js CLIs compiling to single binaries via `pkg`, `bun build --compile`, `deno compile`
- Eliminates "requires Node.js" friction

### TUI renaissance

- Rich interactive terminal UIs via Bubble Tea, Ratatui, Ink
- Full-screen dashboard-style interfaces for monitoring and management

### `--json` as standard

- Machine-readable output is now expected, not optional
- CLIs without `--json` feel incomplete

### `doctor` subcommands

- Self-diagnostic commands becoming standard
- `fly doctor`, `brew doctor`, `resend doctor`

### MCP (Model Context Protocol) integration

- CLIs as MCP servers — expose every subcommand as a tool
- AI agents consuming CLIs programmatically
- `AGENTS.md` / `llms.txt` files describing CLI usage for AI agents

### Shell completion specs

- Fig/Amazon Q popularized rich autocompletion
- Many CLIs now ship completion scripts for bash/zsh/fish
- Completion specs as a community ecosystem

---

## 14. Design Principles

1. **Respect the user's time** — Fast startup, sensible defaults, don't ask what you can infer
2. **Be composable** — Work with pipes, respect stdin/stdout/stderr, support `--json`
3. **Fail gracefully** — Clear errors with actionable suggestions, never raw stack traces
4. **Progressive disclosure** — Simple for beginners, powerful for experts
5. **Be predictable** — Consistent flags (`--verbose`, `--json`, `--force`), consistent behavior
6. **Respect the environment** — `NO_COLOR`, `CI` detection, TTY detection, `TERM`
7. **Configuration hierarchy** — Flags > env vars > project config > global config > defaults
8. **Offer escape hatches** — `--json` for scripting, `--yes`/`-y` to skip confirmations
9. **Provide feedback** — Spinners during work, success/failure messages, timing info
10. **Support discoverability** — Tab completion, interactive prompts, `help`, examples

---

## 15. Testing Strategies

Testing CLIs is uniquely challenging — you're testing a user interface, a machine interface (JSON output), process lifecycle (exit codes, signals), and I/O streams simultaneously.

### The testing pyramid for CLIs

```
         ╱╲
        ╱  ╲        E2E: Full binary execution, real shell
       ╱────╲       (slow, flaky-prone, but catches real bugs)
      ╱      ╲
     ╱────────╲     Integration: Command handlers with mocked HTTP
    ╱          ╲    (the sweet spot — most of your tests live here)
   ╱────────────╲
  ╱              ╲   Unit: Pure functions, parsers, formatters
 ╱────────────────╲  (fast, easy, but misses wiring bugs)
```

### Unit tests — pure logic

Test anything that doesn't touch I/O: argument parsing, output formatting, config resolution, validation.

```typescript
// config.test.ts
import { describe, it, expect } from 'vitest';
import { maskKey, validateTeamName, resolveApiKey } from './config';

describe('maskKey', () => {
  it('masks the middle of a key', () => {
    expect(maskKey('re_123456789abcdef')).toBe('re_...cdef');
  });

  it('handles short keys', () => {
    expect(maskKey('re_abc')).toBe('re_...');
  });
});

describe('validateTeamName', () => {
  it('rejects empty names', () => {
    expect(validateTeamName('')).toBeDefined();
  });

  it('rejects special characters', () => {
    expect(validateTeamName('team name!')).toBeDefined();
  });

  it('accepts valid names', () => {
    expect(validateTeamName('my-team_01')).toBeUndefined();
  });
});
```

### Integration tests — command handlers

The most valuable test layer. Execute the command handler with mocked HTTP, assert on stdout/stderr/exit code.

```typescript
// domains-list.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execCommand } from '../test-utils';

// Mock the HTTP layer, not the command logic
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    domains: {
      list: vi.fn().mockResolvedValue({
        data: [
          { id: 'd_123', name: 'example.com', status: 'verified' },
          { id: 'd_456', name: 'test.io', status: 'pending' },
        ],
      }),
    },
  })),
}));

describe('domains list', () => {
  it('outputs JSON with --json flag', async () => {
    const result = await execCommand(['domains', 'list', '--json']);

    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].name).toBe('example.com');
  });

  it('outputs table format in interactive mode', async () => {
    const result = await execCommand(['domains', 'list'], { tty: true });

    expect(result.stdout).toContain('example.com');
    expect(result.stdout).toContain('verified');
  });

  it('exits 1 on auth failure', async () => {
    const result = await execCommand(['domains', 'list'], { env: {} });

    expect(result.exitCode).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error.code).toBe('auth_error');
  });
});
```

### Testing the JSON output contract

Treat `--json` output as an API. Snapshot tests catch accidental breaking changes.

```typescript
// output-contract.test.ts
import { describe, it, expect } from 'vitest';

describe('JSON output contracts', () => {
  it('list commands return consistent envelope', async () => {
    const result = await execCommand(['domains', 'list', '--json']);
    const json = JSON.parse(result.stdout);

    // Envelope shape must be stable across versions
    expect(json).toHaveProperty('object', 'list');
    expect(json).toHaveProperty('data');
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('error commands return consistent error envelope', async () => {
    const result = await execCommand(['domains', 'get', 'nonexistent', '--json']);
    const json = JSON.parse(result.stderr);

    expect(json).toHaveProperty('error');
    expect(json.error).toHaveProperty('message');
    expect(json.error).toHaveProperty('code');
  });

  it('matches snapshot (catches field additions/removals)', async () => {
    const result = await execCommand(['domains', 'list', '--json']);
    const json = JSON.parse(result.stdout);

    // Snapshot the shape, not the values
    const shape = Object.keys(json.data[0]).sort();
    expect(shape).toMatchInlineSnapshot(`
      [
        "id",
        "name",
        "region",
        "status",
      ]
    `);
  });
});
```

### Testing stderr/stdout separation

```typescript
it('writes progress to stderr, data to stdout', async () => {
  const result = await execCommand(['domains', 'list', '--json']);

  // stdout: only JSON data
  expect(() => JSON.parse(result.stdout)).not.toThrow();

  // stderr: may contain spinner output, but never JSON data
  expect(result.stderr).not.toContain('"data"');
});
```

### Testing exit codes

```typescript
describe('exit codes', () => {
  it('exits 0 on success', async () => {
    const result = await execCommand(['domains', 'list']);
    expect(result.exitCode).toBe(0);
  });

  it('exits 1 on API error', async () => {
    // Mock a 500 response
    const result = await execCommand(['domains', 'get', 'bad-id']);
    expect(result.exitCode).toBe(1);
  });

  it('exits 2 on usage error (missing required flags)', async () => {
    const result = await execCommand(['emails', 'send']);
    expect(result.exitCode).toBe(2);
  });
});
```

### HTTP recording/replaying

Instead of hand-writing mocks, record real HTTP interactions and replay them in tests. This catches API drift.

```typescript
// Using msw (Mock Service Worker) for HTTP interception
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('https://api.resend.com/domains', () => {
    return HttpResponse.json({
      data: [{ id: 'd_123', name: 'example.com', status: 'verified' }],
    });
  }),

  http.post('https://api.resend.com/emails', async ({ request }) => {
    const body = await request.json();
    if (!body.to) {
      return HttpResponse.json(
        { error: { message: 'Missing "to"', code: 'validation_error' } },
        { status: 422 }
      );
    }
    return HttpResponse.json({ id: 'email_123' });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### E2E tests — full binary execution

Spawn the actual compiled binary. Slow but catches bundling, shebang, and path issues.

```typescript
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(__dirname, '../../dist/bin.js');

describe('E2E', () => {
  it('--version prints version and exits 0', () => {
    const result = execFileSync('node', [CLI_PATH, '--version'], {
      encoding: 'utf-8',
    });
    expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('--help exits 0 and shows usage', () => {
    const result = execFileSync('node', [CLI_PATH, '--help'], {
      encoding: 'utf-8',
    });
    expect(result).toContain('Usage:');
    expect(result).toContain('Commands:');
  });

  it('unknown command exits non-zero with suggestion', () => {
    try {
      execFileSync('node', [CLI_PATH, 'domans'], { encoding: 'utf-8' });
    } catch (e) {
      expect(e.status).not.toBe(0);
      expect(e.stderr.toString()).toContain('Did you mean');
    }
  });
});
```

### CI testing considerations

| Concern | Strategy |
|---------|----------|
| TTY vs non-TTY | Test both paths; use `process.stdout.isTTY = true` in integration tests |
| Cross-platform | CI matrix: ubuntu, macos, windows. Path separators break first |
| Shell differences | E2E tests should use `execFile` (no shell), not `exec` |
| Flaky network tests | Always use HTTP mocking (msw); never hit real APIs in CI |
| Startup time regression | Benchmark `--version` time in CI; fail if > threshold |
| Binary size regression | Track binary size in CI; alert on significant increases |

### Test utilities pattern

Build a shared `execCommand` helper that normalizes the testing interface:

```typescript
// test-utils.ts
interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ExecOptions {
  tty?: boolean;
  env?: Record<string, string>;
  stdin?: string;
}

export async function execCommand(
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  // Set up environment
  const env = {
    RESEND_API_KEY: 're_test_123',
    NO_COLOR: '1',
    ...options.env,
  };

  // Mock TTY state
  if (options.tty !== undefined) {
    process.stdout.isTTY = options.tty;
    process.stdin.isTTY = options.tty;
  }

  // Capture stdout/stderr
  const stdout: string[] = [];
  const stderr: string[] = [];
  // ... capture logic ...

  return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode };
}
```

---

## 16. Security

### Credential storage

| Platform | Recommended Storage | Fallback |
|----------|-------------------|----------|
| macOS | Keychain (`security` CLI or `keytar`) | `~/.config/<tool>/credentials.json` (mode 0600) |
| Linux | libsecret / GNOME Keyring | `~/.config/<tool>/credentials.json` (mode 0600) |
| Windows | Windows Credential Manager | `%APPDATA%/<tool>/credentials.json` |
| CI/Docker | Environment variables only | Never write to disk |

**Rules:**
- Config directories: `0700`. Credential files: `0600`. Never world-readable.
- Warn if credentials file has wrong permissions: "Warning: credentials file is world-readable. Run `chmod 600 ~/.config/resend/credentials.json`"
- Never write tokens to shell history — avoid commands like `resend login --api-key re_xxx` appearing in `~/.zsh_history`. Prefer `RESEND_API_KEY=re_xxx resend whoami` or reading from stdin.

### Token handling

```
DO:
  ✔ Mask tokens in all output: re_...cdef
  ✔ Mask tokens in --verbose/debug output
  ✔ Mask tokens in error messages
  ✔ Use short-lived tokens when possible
  ✔ Support token rotation without downtime

DON'T:
  ✗ Log full tokens anywhere (stdout, stderr, debug logs, crash reports)
  ✗ Include tokens in URLs (query parameters)
  ✗ Store tokens in environment variable names (only values)
  ✗ Echo tokens back in success messages ("Logged in with key re_abc123...")
```

### Input sanitization

CLIs that shell out to other commands must sanitize user input:

```typescript
// BAD — command injection via domain name
exec(`dig ${userInput}`);

// GOOD — use execFile (no shell interpretation)
execFile('dig', [userInput]);

// BAD — path traversal
readFile(`./templates/${userInput}`);

// GOOD — validate and resolve
const resolved = path.resolve('./templates', userInput);
if (!resolved.startsWith(path.resolve('./templates'))) {
  throw new Error('Invalid path');
}
```

### Supply chain security

- **Sign binaries** — GPG or Sigstore/cosign for GitHub releases
- **Publish checksums** — `SHA256SUMS` file alongside release artifacts
- **Verify on install** — Install scripts should verify checksums before executing

```bash
# Example install script pattern
curl -fsSL https://github.com/resend/resend-cli/releases/latest/download/SHA256SUMS -o checksums.txt
curl -fsSL https://github.com/resend/resend-cli/releases/latest/download/resend-darwin-arm64 -o resend
sha256sum --check --ignore-missing checksums.txt
chmod +x resend
```

### Secure defaults

- `--yes` should **not** be the default — destructive actions require explicit confirmation
- API keys should never be passed as positional arguments (visible in `ps` output)
- Temp files containing sensitive data should use `0600` permissions and be cleaned up
- Consider `RESEND_API_KEY_FILE` for environments where env vars are logged (some CI systems)

---

## 17. Plugin and Extension Architecture

### The `gh` extension model — the gold standard

```
gh extension install owner/gh-extension-name
gh extension list
gh extension remove owner/gh-extension-name
```

**How it works:**
1. Extensions are Git repos with a naming convention: `gh-<name>`
2. The repo contains a binary or script that `gh` discovers and executes
3. Extensions receive the same auth context as the host CLI
4. Discovery via `gh extension search` queries GitHub

**Why it works:**
- Zero coupling — extensions are standalone executables
- Any language — Go, Python, Bash, Node.js
- Distribution via Git — no registry to maintain
- Auth is inherited — extensions call `gh api` with the user's token

### Design patterns for plugin systems

#### 1. Executable discovery (gh model)

```
~/.config/resend/extensions/
  resend-webhooks/
    resend-webhooks        # executable binary or script
  resend-templates/
    resend-templates
```

The CLI scans the extensions directory, finds executables matching `resend-<name>`, and registers them as subcommands. Simplest to implement.

#### 2. Hook system (git model)

```
# .resend/hooks/pre-send    — runs before emails send
# .resend/hooks/post-deploy — runs after deployment

resend emails send --to user@example.com
# → pre-send hook fires (can validate, transform, or abort)
# → send executes
# → post-send hook fires (can log, notify, etc.)
```

#### 3. npm-based plugins (oclif model)

```
resend plugins install @resend/plugin-templates
resend plugins list
resend plugins remove @resend/plugin-templates
```

Plugins are npm packages that export command definitions. More structured but requires Node.js.

### Plugin security considerations

| Concern | Mitigation |
|---------|-----------|
| Malicious plugins | Show a warning on install: "This extension is not verified by Resend" |
| Auth token access | Plugins inherit CLI auth by default — consider scoped tokens for extensions |
| File system access | No sandboxing in most models — document the trust model clearly |
| Version conflicts | Extensions should declare compatible CLI versions |
| Update channel | `resend extension upgrade <name>` — don't auto-update plugins silently |

### When to build a plugin system

- **Do** if you have > 20 commands and community contributions are expected
- **Do** if different teams need domain-specific commands
- **Don't** if you have < 10 commands — premature complexity
- **Don't** if all commands map 1:1 to your API — the core CLI should cover it

---

## 18. Versioning and Backwards Compatibility

### What constitutes a breaking change in a CLI

| Change | Breaking? | Notes |
|--------|-----------|-------|
| Remove a flag | Yes | Scripts using `--old-flag` break |
| Rename a flag | Yes | Same as removal |
| Change flag default value | Yes | Existing scripts assume old default |
| Remove a command | Yes | Scripts calling it break |
| Rename a command | Yes | Keep old name as alias |
| Change `--json` output fields (remove/rename) | Yes | Machine consumers break |
| Add new `--json` output fields | No | Additive is safe |
| Change exit codes | Yes | CI scripts branch on exit codes |
| Change human-readable output format | No | Humans adapt; machines use `--json` |
| Add a new command | No | Nothing depends on it yet |
| Add a new flag | No | Existing invocations unaffected |

### Deprecation strategy

```
Phase 1: Warn (version N)
  $ resend emails send --subject "Hello"
  ⚠ Warning: --subject is deprecated, use --header-subject instead.
    --subject will be removed in v3.0.

Phase 2: Error with migration hint (version N+1)
  $ resend emails send --subject "Hello"
  Error: --subject was removed in v2.5. Use --header-subject instead.

Phase 3: Remove (version N+2)
  (flag no longer recognized)
```

**Implementation:**

```typescript
function deprecatedFlag(
  oldName: string,
  newName: string,
  removeVersion: string
): void {
  console.error(
    `⚠ Warning: --${oldName} is deprecated, use --${newName} instead. ` +
    `--${oldName} will be removed in v${removeVersion}.`
  );
}
```

### JSON output as a versioned API

- **Rule:** `--json` output is a public API contract. Treat it like a REST API.
- **Additive only:** Add new fields freely. Never remove or rename fields without a major version bump.
- **Schema versioning:** Consider `{"_version": 2, "data": [...]}` if you foresee breaking changes.
- **Document the contract:** Publish JSON schemas or TypeScript types for output shapes.

### How the best CLIs handle breaking changes

| CLI | Strategy |
|-----|----------|
| **gh** | Very conservative — aliases old command names, rarely removes flags. Major versions are rare. |
| **kubectl** | `kubectl alpha` → `kubectl beta` → stable promotion pipeline. Alpha commands can break freely. |
| **stripe** | API version pinning — `--api-version 2024-01-01`. CLI adapts to the API version. |
| **aws** | `aws configure` migrates config formats. `aws2` was a separate binary during the v1→v2 transition. |

### Migration tooling

For major version bumps, consider:

```bash
# Scan scripts for deprecated usage
resend migrate check ./scripts/

# Auto-fix simple renames
resend migrate fix ./scripts/

# Show migration guide
resend migrate guide v1-to-v2
```

---

## 19. Documentation Patterns

### `--help` is the primary documentation

Users read `--help` 10x more than docs websites. Invest heavily here.

**Structure of great help text:**

```
Usage: resend emails send [options]

Send an email via the Resend API.

Options:
  --from <address>       Sender email address (required)
  --to <address...>      Recipient email addresses (required)
  --subject <text>       Email subject line (required)
  --html <html>          HTML body (reads from stdin if -)
  --text <text>          Plain text body
  --reply-to <address>   Reply-to address
  --cc <address...>      CC recipients
  --bcc <address...>     BCC recipients
  --json                 Output result as JSON
  -h, --help             Show this help

Examples:
  # Send a simple email
  $ resend emails send --from hi@example.com --to user@test.com --subject "Hello" --text "World"

  # Send HTML from a file
  $ cat template.html | resend emails send --from hi@example.com --to user@test.com --subject "News" --html -

  # Send to multiple recipients
  $ resend emails send --from hi@example.com --to a@test.com b@test.com --subject "Update" --text "Hi all"
```

**Key elements:**
1. **One-line description** — what the command does
2. **Options with types** — `<address>` not just a flag name
3. **Required markers** — `(required)` so users know what's mandatory
4. **Examples** — the most-read section. 2-4 progressively complex examples.

### Examples are documentation

The `Examples:` section of `--help` is the most important documentation you'll write:

- Start simple, get progressively complex
- Show **real, runnable** commands (not pseudo-code)
- Cover the common cases, not edge cases
- Include pipe examples for composability
- Every flag you add should appear in at least one example

### Man pages

```bash
# Generate man pages from Commander.js help text
resend --help-all > docs/resend.1.md
pandoc docs/resend.1.md -s -t man -o docs/resend.1

# Install man page
install -m 644 docs/resend.1 /usr/local/share/man/man1/
```

Man pages matter for:
- Linux users who expect `man resend`
- Offline documentation
- System administrators who distrust online docs

### Auto-generated web docs

The best CLIs auto-generate their docs website from command definitions:

```
Commander.js metadata
        ↓
  JSON export (resend commands --json)
        ↓
  Static site generator (Astro, Next.js, Docusaurus)
        ↓
  docs.resend.com/cli/commands/emails/send
```

This ensures docs are always in sync with the actual CLI behavior. `gh`, `stripe`, and `kubectl` all do this.

### Shell completions as documentation

Completions are live documentation — they show available commands, flags, and valid values as the user types.

```bash
# Commander.js can generate completion scripts
resend completion bash > /etc/bash_completion.d/resend
resend completion zsh > ~/.zsh/completions/_resend
resend completion fish > ~/.config/fish/completions/resend.fish
```

Rich completions include descriptions:

```
$ resend domains <TAB>
list     -- List all domains
create   -- Add a new domain
get      -- Get domain details
verify   -- Verify a domain
delete   -- Delete a domain
```

### Documenting for AI agents

As AI agents increasingly consume CLIs, consider:

- **`AGENTS.md`** — a file in your repo describing how an AI agent should use the CLI. Commands, common workflows, gotchas.
- **`llms.txt`** — emerging standard for describing tool capabilities to LLMs
- **MCP server description** — the `setup` command that registers the CLI as an MCP server should include rich descriptions for every tool

```markdown
<!-- AGENTS.md -->
# Resend CLI — Agent Guide

## Authentication
Set RESEND_API_KEY environment variable. Do not use `resend login` (interactive).

## Common workflows
- Send email: `resend emails send --from X --to Y --subject Z --text W --json`
- List domains: `resend domains list --json`
- Check domain status: `resend domains get <id> --json`

## Important notes
- All mutating commands require `--yes` to skip confirmation
- Use `--json` for all commands to get structured output
- Errors are on stderr in format: {"error": {"message": "...", "code": "..."}}
```

---

## 20. Telemetry and Analytics

### The ethical framework

Telemetry is valuable for prioritizing features and finding bugs, but must respect user trust.

| Principle | Implementation |
|-----------|---------------|
| **Opt-in preferred** | Ask on first run: "Help improve Resend CLI by sharing anonymous usage data?" |
| **Opt-out minimum** | If opt-out: clear disclosure on first run + easy disable |
| **Transparent** | `resend telemetry status` shows what's collected |
| **Controllable** | `resend telemetry disable` / `RESEND_TELEMETRY=0` |
| **Never block** | Telemetry failures must be silent and never slow down commands |

### What to collect (and what not to)

```
COLLECT:
  ✔ Command name (e.g., "domains.list")
  ✔ Flags used (names only, not values): ["--json", "--limit"]
  ✔ Exit code (0, 1, 2)
  ✔ Execution duration (ms)
  ✔ CLI version
  ✔ OS and architecture
  ✔ Node.js version
  ✔ Error codes (e.g., "auth_error", "network_error")
  ✔ Whether running in CI (boolean)

NEVER COLLECT:
  ✗ Flag values (may contain secrets, emails, PII)
  ✗ API keys or tokens
  ✗ Email addresses, domain names, or any user content
  ✗ File paths (may reveal project structure)
  ✗ Request/response bodies
  ✗ IP addresses (anonymize at collection point)
  ✗ Anything that could identify a specific user or project
```

### Implementation pattern

```typescript
// telemetry.ts
async function trackCommand(event: {
  command: string;
  flags: string[];
  exitCode: number;
  durationMs: number;
  error?: string;
}): Promise<void> {
  // Never block the main command
  if (!isTelemetryEnabled()) return;

  // Fire and forget — use unref() so Node.js doesn't wait
  const req = https.request(TELEMETRY_ENDPOINT, { method: 'POST' });
  req.on('error', () => {}); // Swallow errors
  req.write(JSON.stringify({
    ...event,
    cli_version: VERSION,
    os: process.platform,
    arch: process.arch,
    node: process.version,
    ci: isCI(),
    timestamp: new Date().toISOString(),
  }));
  req.end();
  req.socket?.unref(); // Don't keep process alive
}
```

### Disclosure patterns from the best CLIs

| CLI | Model | Disclosure |
|-----|-------|-----------|
| **Vercel/Next.js** | Opt-out, prompted | First run shows: "Vercel collects anonymous telemetry data. Run `next telemetry disable` to opt out." |
| **Turborepo** | Opt-out, prompted | Same pattern as Vercel |
| **Homebrew** | Opt-out | `HOMEBREW_NO_ANALYTICS=1` or `brew analytics off` |
| **Angular CLI** | Opt-in | Asks on `ng new`: "Would you like to share anonymous usage data?" |
| **Stripe** | No telemetry | Relies on API-side analytics instead |

### Environment variable conventions

```bash
# Disable telemetry
RESEND_TELEMETRY=0
DO_NOT_TRACK=1          # Emerging cross-tool standard
CI=true                 # Many CLIs disable telemetry in CI by default
```

---

## 21. Accessibility

### Terminal accessibility is underserved

Most CLI developers never test with a screen reader. Terminal accessibility is an emerging concern that separates thoughtful CLIs from the rest.

### Screen readers and terminal output

Screen readers (VoiceOver, NVDA, JAWS) read terminal output line by line. Key considerations:

- **Spinners are hostile** — rapidly updating characters create a flood of announcements. Use `aria-live` regions (not applicable in terminals) or simply suppress spinners when `TERM=dumb` or a screen reader is detected.
- **Progress bars** — same issue. Prefer periodic percentage announcements: "Uploading... 25%... 50%... 100% done."
- **ANSI escape codes** — screen readers may read raw escape sequences if not properly handled. Always strip ANSI when `NO_COLOR` is set.
- **Tables** — visual alignment means nothing to screen readers. Consider `--format list` as an alternative that outputs key-value pairs line by line.

### Color and visual design

- **Never use color as the sole indicator** — always pair with symbols:
  - `✔ Success` (green) — the `✔` carries meaning even without color
  - `✗ Error` (red) — the `✗` is readable in monochrome
  - `⚠ Warning` (yellow) — the `⚠` symbol is self-explanatory
- **Test with `NO_COLOR=1`** — your output should be fully usable
- **High contrast** — avoid dim/gray text for critical information (use it only for secondary hints)
- **Color blindness** — red/green is the most common deficiency. Don't rely on red vs. green to distinguish error from success — the `✔`/`✗` symbols are essential.

### Keyboard navigation

- **All interactive prompts must be keyboard-navigable** — @clack/prompts and Inquirer.js handle this well
- **No mouse-only interactions** — terminal UIs should never require mouse clicks
- **Escape always cancels** — consistent exit from any prompt
- **Tab completion** — reduces typing burden for users with motor impairments

### Cognitive accessibility

- **Consistent patterns** — every list command works the same way, every delete requires the same confirmation flow
- **Progressive disclosure** — don't overwhelm with options. Show common flags in `--help`, hide advanced ones behind `--help-all`
- **Clear error messages** — say what went wrong and what to do about it (see [Section 5](#5-error-handling))
- **Predictable defaults** — users shouldn't need to remember obscure flags for common operations

### Environment variables for accessibility

| Variable | Purpose |
|----------|---------|
| `NO_COLOR` | Disable all color output |
| `TERM=dumb` | Disable all formatting, spinners, progress |
| `CI=true` | Non-interactive mode (no prompts, no animations) |
| `FORCE_COLOR=0` | Alternative color disable (used by chalk/picocolors) |
| `COLUMNS` | Override detected terminal width |

### Testing accessibility

```bash
# Test with no color
NO_COLOR=1 resend domains list

# Test with dumb terminal (no formatting)
TERM=dumb resend domains list

# Test with narrow terminal
COLUMNS=40 resend domains list

# Test with screen reader (macOS)
# Enable VoiceOver (Cmd+F5), then run commands and listen
```

---

## Key References

- [Command Line Interface Guidelines (clig.dev)](https://clig.dev) — The canonical CLI design guide
- [12 Factor CLI Apps](https://medium.com/@jdxcode/12-factor-cli-apps-dd3c227a0e46) — Jeff Dickey (oclif creator)
- [Charm.sh](https://charm.sh) — The Go TUI ecosystem
- [@clack/prompts](https://github.com/natemoo-re/clack) — Beautiful Node.js prompt library
- [no-color.org](https://no-color.org) — The `NO_COLOR` standard
- [console.dev/guides/cli](https://console.dev) — Console.dev CLI tool reviews and patterns
- [msw.io](https://mswjs.io) — Mock Service Worker for HTTP testing
- [semver.org](https://semver.org) — Semantic Versioning specification
- [do-not-track.dev](https://consoledonottrack.com) — The `DO_NOT_TRACK` standard for CLIs
