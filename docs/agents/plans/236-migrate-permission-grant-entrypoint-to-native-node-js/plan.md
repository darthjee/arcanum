# Plan: Migrate permission-grant entrypoint to native Node.js

Issue: [236-migrate-permission-grant-entrypoint-to-native-node-js.md](../issues/236-migrate-permission-grant-entrypoint-to-native-node-js.md)

## Overview

Add a native `core/lib/PermissionGrant.js`, routed via `core/bin/arcanum permission-grant add <file> <pattern>`, reusing the existing `Lock.js` for locking. Wire `arcanum/_lib/permission_grant.sh`'s CLI-dispatcher path through `engine_dispatch` (the same shell/native switch used by `checkout_safe_branch.sh`/`list_agents.sh`), flip `permission-grant` to `true` in `migration-status.json`, and regenerate the migration-status doc — following the pattern from #227/#233/#234.

`permission_grant.sh` is unusual among migrated entrypoints in being dual-mode: a **sourced library** (`permission_grant_add`, called in-process by several `arcanum/migrations/repos/*/*.sh` scripts) as well as a **standalone CLI** (`permission_grant.sh add <file> <pattern>`, used by `init-claude/setup_permissions.md`). Only the CLI path is in scope for native routing — see Shared Contracts below.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command name / routing**: `permission-grant`, dispatched as `core/bin/arcanum permission-grant add <file> <pattern>` — `core/bin/arcanum`'s router calls `new PermissionGrant().run('add', file, pattern)`.
- **`PermissionGrant.js#run(action, file, pattern)`** (async, returns a Promise):
  - `action !== 'add'` (or an unrecognized/missing action) → writes `Usage: permission_grant.sh add <file> <pattern>` to stderr and exits 1, mirroring the shell dispatcher's usage case. Validate this defensively in the native module itself (not only in the shell shim), since `core/bin/arcanum permission-grant ...` can be invoked directly (e.g. by the parity spec) without going through the shim's own case statement.
  - `action === 'add'` → creates `<file>`'s parent directory (mkdir -p semantics); on failure, writes the same degrade-on-failure warning text as the shell version to stderr and returns/exits 0 (no throw) — same posture as the shell's `permission_grant_add`.
  - Reads `<file>` (treating missing-or-invalid-JSON as `{}`), merges `pattern` into `.permissions.allow` with the same semantics as `.permissions.allow = ((.permissions.allow // []) + [$p] | unique)`, leaving every other top-level key untouched, and writes atomically (`.tmp` + rename).
  - Locking: acquire `<file>.lock` via `core/lib/Lock.js` (`new Lock().acquire(lockFile)` / `.release(lockFile)`) around the read-merge-write, exactly mirroring `lock.sh`'s protocol that the shell version already delegates to — do not reimplement locking.
- **`migration-status.json` key**: `permission-grant` (flipped `false` → `true` only after the native module + registry wiring exist and pass tests — node's work must land before scripter's flag flip is meaningful, even though both ship in the same PR).
- **Scope boundary**: the sourced-function path (`permission_grant_add`, called in-process by `arcanum/migrations/repos/*/*.sh`) stays pure shell, unconditionally — it is a function call, not a process boundary, so `engine_dispatch`'s shell/native switch (which operates per-process, keyed on a `repo_path` to read `engine.mode`) does not apply to it and existing call sites (`source ".../permission_grant.sh"; permission_grant_add "$file" "$pattern"`) must keep working unchanged. Only the bottom CLI-dispatcher block (`permission_grant.sh add <file> <pattern>` run as a script) gets `engine_dispatch`-routed.
- **Implicit `repo_path` for the CLI path**: unlike `checkout_safe_branch.sh`/`list_agents.sh`, `permission_grant.sh`'s CLI signature has no `<repo_path>` argument — existing callers already invoke it with the target repo as the current working directory and a repo-relative `<file>` (e.g. `init-claude/setup_permissions.md`'s `../arcanum/_lib/permission_grant.sh add .claude/settings.json "..."`). Use `repo_path="$(pwd)"` when calling `engine_dispatch`, consistent with that existing convention — do not add a new required CLI argument.
