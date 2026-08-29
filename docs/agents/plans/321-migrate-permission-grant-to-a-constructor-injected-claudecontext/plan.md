# Plan: Migrate permission-grant to a constructor-injected ClaudeContext

Issue: [321-migrate-permission-grant-to-a-constructor-injected-claudecontext.md](../../issues/321-migrate-permission-grant-to-a-constructor-injected-claudecontext.md)

## Overview

Introduce `core/lib/context/ClaudeContext.js` as a peer to `RepoContext` — a
small per-call bundle that anchors resolution of Claude Code's native settings
files (`<repo>/.claude/settings*.json` and the global
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`). Replace the registry's
`takesRepoContext` boolean with a `context: 'repo' | 'claude' | 'none'` enum,
teach `Dispatcher` to build and inject the right context per entry (stripping the
leading anchor arg for both `'repo'` and `'claude'`), and migrate
`permission-grant` to `context: 'claude'` so it stops being an exempt command.
The bash shim (`arcanum/_lib/permission_grant.sh` + its shell fallback) and the
sole CLI caller (`init-claude/setup_permissions.md`) gain the new leading anchor
argument. `RunContext` and the `permission-grant-add` registry-shape split
(#328) are explicitly out of scope.

## Context

`permission-grant` is currently on #314's exempt list as if it were
context-free, but it is not: which settings file it writes (local / project /
global, honoring `CLAUDE_CONFIG_DIR`) is real context that today leaks into
`setup_permissions.md` prose and the `arcanum/migrations/repos/*/*.sh` shells,
and `permission_grant_shell.sh` resolves a relative `<file>` against ambient
cwd. `RepoContext` is the wrong object (none of its 5 collaborators apply);
`ClaudeContext` is the right-sized one. This issue also owns the full
`takesRepoContext` → `context` enum reshape end to end; #314 (blocked on #308
sub-issues 2–5) later rebases onto the shipped enum and does none of it.

Default `engine.mode` is `shell`, so `permission_grant_shell.sh` — not the
native path — runs in most repos; shell/native parity for the new leading
argument is a hard requirement.

## Agents involved

- [node](node.md) — `ClaudeContext` class, the `context` enum in the registry,
  the `Dispatcher` branch, and the `PermissionGrant` migration, plus all
  affected `core/spec` suites.
- [scripter](scripter.md) — the leading anchor argument in
  `arcanum/_lib/permission_grant.sh` and its `permission_grant_shell.sh`
  fallback dispatcher.
- [skill-writer](skill-writer.md) — the leading anchor argument on
  `init-claude/setup_permissions.md`'s four `permission_grant.sh` invocations.

## Shared contracts

### 1. `permission_grant.sh` CLI signature (scripter → skill-writer, node)

New form: `permission_grant.sh <anchor> add <file> <pattern>`

- `<anchor>` — new leading positional. Absolute path to the repo root the Claude
  config is anchored at. Every caller today passes a repo root; a dedicated
  global-scope marker is out of scope (see Notes).
- `<file>` — unchanged. An explicitly-passed settings-file path, accepted as-is;
  may be repo-relative (e.g. `.claude/settings.json`) or absolute.
- `<pattern>` — unchanged.

The `permission_grant.sh add …` (no anchor) form is removed; there is exactly
one CLI caller and it is updated in the same change.

### 2. argv into `core/bin/arcanum` (scripter → node)

The shim runs:

```
engine_dispatch "<anchor>" permission-grant "<shell_fallback>" -- "<anchor>" add "<file>" "<pattern>"
```

so `core/bin/arcanum permission-grant` receives argv
`["<anchor>", "add", "<file>", "<pattern>"]`. `Dispatcher`, for
`context: 'claude'`, strips `args[0]` (`<anchor>`), builds the `ClaudeContext`
from it, and invokes `run("add", "<file>", "<pattern>")` — `run`'s signature is
therefore unchanged.

### 3. shell-fallback parity (scripter)

`engine.mode=shell` (the default) sends the identical argv to
`permission_grant_shell.sh`: `<anchor> add <file> <pattern>`. Its CLI dispatcher
must consume and ignore the leading `<anchor>` — the shell path keeps resolving
`<file>` against its own cwd, so behaviour is identical whenever `<anchor>`
equals the invoking cwd (which it always does for the real caller). The sourced
`permission_grant_add` function is **not** touched:
`arcanum/migrations/repos/*/*.sh` keep calling `permission_grant_add <file>
<pattern>` in-process, unchanged.

### 4. `context` registry enum (node; referenced by all)

`CommandEntry.context: 'repo' | 'claude' | 'none'`, absent ≡ `'none'`:

- `'repo'` — `new ModuleClass(repoContext)` built from `args[0]`; `args[0]`
  stripped from the method args. Every current `takesRepoContext: true` entry is
  mechanically converted to `context: 'repo'`.
- `'claude'` — `new ModuleClass(claudeContext)` built from `args[0]`; `args[0]`
  stripped. Only `permission-grant`.
- `'none'` / absent — `new ModuleClass()`, args untouched
  (`dispatch-fixture(-crash)`, `auto-fix-all-config-*`, `auto-fix-all-queue-*`,
  `arcanum-update-run-update-*`).

### 5. `ClaudeContext` constructor + minimum surface (node)

`new ClaudeContext({ repoPath })` — same `{ repoPath }` key as `RepoContext` for
consistency; `repoPath` is the `<anchor>`. It must at minimum let
`PermissionGrant` resolve a possibly-relative `<file>` against the anchor rather
than `process.cwd()` (e.g. a `resolve(file)` returning
`path.isAbsolute(file) ? file : path.resolve(this.repoPath, file)`), and expose
the global settings path (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`)
for future callers. Exact method names are node's call.

### 6. `setup_permissions.md` anchor value (skill-writer)

The four `permission_grant.sh` invocations gain a leading `"$REPO_PATH"` — the
onboarded repo root, already resolved once at the top of the `init-claude` run
per `docs/agents/architecture/repo-path-threading.md`.

## Notes

- **`run` signature is unchanged.** `Dispatcher` strips the anchor;
  `PermissionGrant#run(action, file, pattern)` and the `action !== 'add'` usage
  guard stay exactly as they are. Only the constructor changes
  (`constructor(claudeContext, { lock } = {})`, matching `IssueState` /
  `SpawnIssue` / `ListAgents`).
- **No `migration-status.json` / `entrypoint-migration-status.md` change.** The
  command key stays `permission-grant`; renaming it to `permission-grant-add` is
  #328's job.
- **Global-scope anchor.** Today every caller anchors at a repo root, so a
  distinct "global" marker value for `<anchor>` is not built here. `ClaudeContext`
  still exposes the global settings path for callers that need it; a marker can
  be added when a global-only CLI caller appears.
- **`docs/agents/architecture/script-engine.md`** lines ~55 and ~61 describe the
  old "zero constructor arguments" / `RepoContext`-only dispatch shape and are
  already partly stale post-`takesRepoContext`. Architect to add `ClaudeContext`
  as a peer per-call bundle on line ~55 and note the `context` enum; deeper
  rewording of line ~61 belongs with #314's cleanup.
- **`#328` interaction.** No hard dependency. If #328 lands first, this issue
  adds `context: 'claude'` to the already-renamed `permission-grant-add` entry;
  if this lands first, #328 renames the `context: 'claude'` entry.

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)
- Shell changes (`arcanum/_lib/permission_grant*.sh`) have no dedicated CI gate;
  keep them shellcheck-clean (the files carry `# shellcheck source=` directives).
