# Issue: Migrate permission-grant to a constructor-injected ClaudeContext

## Description

Spun off from the discussion on #314 (sub-issue 6 of #308). #314 wants to drop
the `takesRepoContext` flag and make `RepoContext` construction plus the
leading-`repoPath` arg strip unconditional in `Dispatcher`. That can only happen
once every command currently treated as *exempt* has been reviewed and either
migrated or deliberately confirmed as exempt. This issue covers `PermissionGrant`
(`permission-grant`) and resolves it by migration.

Current state:

- Registry entry: `permission-grant` -> `commands/PermissionGrant.js`, method
  `run`, no `takesRepoContext`.
- Dispatched as `permission-grant add <file> <pattern>` — args are
  `['add', <file>, <pattern>]`. There is **no `repoPath` argument** at any
  position.
- `run(action, file, pattern)` requires `action === 'add'`; anything else throws
  the shell dispatcher's usage message.
- Constructor is `constructor({ lock = new Lock() } = {})` — takes an injectable
  `Lock`, nothing repo-shaped.
- `<file>` is an explicitly-passed absolute path to a Claude Code *native*
  settings file (`.claude/settings.local.json`, `.claude/settings.json`, or
  `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`) — not an arcanum
  namespaced config file, and not necessarily inside any repo.
- The sourced `permission_grant_add` function is also called in-process (never
  through the dispatcher) by `arcanum/migrations/repos/*/*.sh`; that path stays
  pure shell regardless.
- The only CLI caller is `init-claude/setup_permissions.md`'s onboarding step.

## Problem

`permission-grant` currently sits on #314's exempt list as if it were
context-free, but it is not:

- It operates on Claude Code's native settings files, and *which* file (local /
  project / global, honoring `CLAUDE_CONFIG_DIR:-$HOME/.claude`) is real context.
  Today that knowledge leaks into `init-claude/setup_permissions.md`'s prose and
  the `arcanum/migrations/repos/*/*.sh` shells rather than living in a single
  testable place.
- #314 cannot go marker-free until this command is explicitly classified.

Alternatives considered and rejected:

- **Stay plain-exempt.** Leaves the settings-file-location leak in place and
  leaves #314's exempt-vs-migrated binary incomplete.
- **Inject an unused `RepoContext`.** Dead weight — none of `RepoContext`'s five
  collaborators (`origin`, `githubToken`, `issueStateService`, `configChain`,
  `githubIssue`) apply, and the constructor would claim a dependency it never
  reads.
- **Build `RunContext` now.** No command needs both a `RepoContext` and a
  Claude-config context in one call yet; the wrapper would ship with an unused
  half. Deferred until a real both-halves customer appears.

## Expected Behavior

- A `ClaudeContext` class exists as a peer to `RepoContext` — a small context
  object for "the Claude configuration location" (local / project / global
  settings-file tiers plus `CLAUDE_CONFIG_DIR` resolution). It is a separate
  concern from `RepoContext`, not a field on it.
- `permission-grant` is a migrated command: its registry entry declares
  `context: 'claude'`, and its constructor receives a `ClaudeContext`. It is no
  longer on #314's exempt list.
- The per-command registry declaration is a small enum, replacing the
  `takesRepoContext` boolean (exact spelling a planning detail):
  - `context: 'repo'` — `new ModuleClass(repoContext)`, leading `repoPath` arg
    stripped from the method args (the default target of #314).
  - `context: 'claude'` — `new ModuleClass(claudeContext)`, leading anchor arg
    stripped from the method args.
  - `context: 'none'` / absent — `new ModuleClass()`, args untouched. Covers
    `dispatch-fixture(-crash)` and the commands that read `repoPath` as a plain
    method arg without a context object (`auto-fix-all-config-*`,
    `auto-fix-all-queue-*`, `arcanum-update-run-update-*`).
- `init-claude/setup_permissions.md` passes the new leading anchor arg (the
  onboarded repo's root).
- The in-process pure-shell `permission_grant_add` path used by
  `arcanum/migrations/repos/*/*.sh` is unchanged.
- No `RunContext` is introduced.

## Solution

**In scope**

- New `ClaudeContext` class (settings-file location / `CLAUDE_CONFIG_DIR`
  resolution).
- The full `takesRepoContext` boolean -> `context` enum reshape: the new
  `Dispatcher` branch, **and** the mechanical conversion of every existing
  `takesRepoContext: true` registry entry to `context: 'repo'`. #321 owns this
  end to end.
- `permission-grant` migration to `context: 'claude'`, including the
  `setup_permissions.md` callsite and specs.

**Out of scope**

- `RunContext` (deferred until a both-halves customer exists).
- Migrating any other command onto `ClaudeContext`.
- Reshaping `PermissionGrant#run` from an `action`-dispatching method into
  per-subcommand registry entries — tracked separately in **#328** (independent
  cleanup, no hard dependency either way; whichever lands second rebases onto the
  other).
- The pure-shell `permission_grant_add` in-process path.

**Planning-level details to confirm (not blockers)**

- **Explicit `<file>` vs. scope selector.** Does `permission-grant`'s CLI keep
  taking an explicitly-resolved `<file>` path, or shift to a
  `local` / `project` / `global` scope token that `ClaudeContext` resolves?
  Leaning toward keeping `<file>` explicit (smallest change; `ClaudeContext`
  still available for callers that want resolution).
- **`ClaudeContext`'s leading arg.** A repo root to anchor local / project
  `.claude/` resolution, plus a global-scope marker for the
  `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` case.
- **`run` signature.** With a leading anchor arg added and stripped by
  `Dispatcher`, `run(action, file, pattern)` is unchanged in shape; the
  `action !== 'add'` usage-message guard stays as-is.

**Testing strategy**

- `Dispatcher` specs: assert a `context: 'claude'` command is constructed with a
  `ClaudeContext` and gets its leading anchor arg stripped; assert
  `context: 'repo'` and `context: 'none'` behaviour is unchanged.
- `ClaudeContext` unit specs: the local / project / global tier resolution and
  the `CLAUDE_CONFIG_DIR` vs. `$HOME/.claude` fallback.
- `PermissionGrant` specs updated for the new constructor signature; the
  `add` / dedupe / atomic-write / silent-degrade behaviour is otherwise
  unchanged.
- Full `core/spec` suite green.

**Relation to #308 / #314**

- #321 no longer "blocks #314 pending a decision" — the decision is made:
  `permission-grant` is a migrated `context: 'claude'` command, not an exempt
  one.
- Sequencing: this issue introduces the `context` enum (replacing
  `takesRepoContext`) and does the full mechanical conversion of all existing
  entries. #314 goes second and only rebases onto the shipped enum — dropping
  the per-entry `context: 'repo'` where it becomes `Dispatcher`'s default, and
  keeping its exempt-list doc comment for the `context: 'none'` entries. #314 is
  blocked on #308 sub-issues 2-5 regardless, so #321-first is the natural order;
  no part of the enum reshape is left for #314 to do.

## Benefits

- Unblocks #314 with a clean, honest classification instead of an unresolved
  exemption.
- Moves the "which Claude settings file" knowledge out of `setup_permissions.md`
  prose and the migration shells into a single testable `ClaudeContext` unit.
- Establishes a consistent one-context-per-command model
  (`repo` / `claude` / `none`) without speculative generality — `RunContext` is
  deferred until a command genuinely needs both halves.
