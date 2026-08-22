# Issue: Migrate issue-state entrypoint to native Node.js

## Description

Migrate `arcanum/_lib/issue_state.sh` to native Node.js — part of the migration batch tracked in #232 (following #192, #193, #227), under the shell → Node.js migration described in [docs/agents/architecture/script-engine.md](docs/agents/architecture/script-engine.md).

`issue_state.sh` provides safe, lock-protected read/write access to `<repo_path>/.claude/state/issue-<id>.json` via four subcommands (`get`, `set`, `set-json`, `append-json`). It has its own inline lock implementation predating `lock.sh`/`Lock.js`.

`core/lib/IssueState.js` already exists but only has a `write` method (used internally by `GithubIssue.js.fetch`) — it does not cover any of the four CLI subcommands below. This issue is the **full build** described in #232's original scope, not a wiring task; the new methods must reuse `write`'s internals wherever their merge semantics overlap, rather than duplicating that logic.

## Problem

`issue_state.sh` is one of the remaining shell entry points not yet covered by the native Node.js engine. It has its own inline lock implementation (distinct from `lock.sh`), duplicating logic that already exists, in a more general form, in `core/lib/Lock.js`.

## Expected Behavior

Byte-identical output/exit-code to `issue_state.sh` for all four subcommands, including the empty-string-on-missing-field behavior for `get` and the exact error/usage text.

Usage / output contract:
```
issue_state.sh <repo_path> get <id> <field>                     → prints value or empty string, exit 0
issue_state.sh <repo_path> set <id> <field> <value>              → sets string field, exit 0
issue_state.sh <repo_path> set-json <id> <field> <json_value>    → sets JSON field (array/object), exit 0
issue_state.sh <repo_path> append-json <id> <field> <json_value> → appends to a JSON array field, exit 0
```
- State file: `<repo_path>/.claude/state/issue-<id>.json`; lock file: `<repo_path>/.claude/state/issue-<id>.lock`.
- Missing args: usage message to stderr, exit 1.
- Unknown command: `Unknown command: <command>` + usage to stderr, exit 1.
- `get` on a missing field: empty string, exit 0 (never errors).

JSON merge semantics to replicate exactly:
- `set`: `.[$field] = $value` (string)
- `set-json`: `.[$field] = $value` (parsed JSON)
- `append-json`: `.[$field] = ((.[$field] // []) + [$value])`

## Solution

Following the pattern from #227/PR #228:

1. Extract `arcanum/_lib/issue_state.sh`'s current body to `arcanum/_lib/issue_state_shell.sh` as the fallback, and convert `issue_state.sh` into a thin `engine_dispatch.sh` shim (matching the `checkout_safe_branch.sh`/`checkout_safe_branch_shell.sh` split from #233).
2. Extend `core/lib/IssueState.js` with a `run`/`get`/`set`/`setJson`/`appendJson` method set, registered in `core/bin/arcanum`'s `COMMANDS` map and routed as `core/bin/arcanum issue-state <repo_path> <get|set|set-json|append-json> <id> <field> [value]` (repo_path before the subcommand, matching the shell script's own argument order — `run` dispatches internally on the subcommand, the same shape as the shell script's `case` statement).
3. Reuse `core/lib/Lock.js` for locking — mandatory, not optional. Do not port a second, near-identical inline lock implementation; the shell script's lock protocol shape (instance id, sleep, re-read, retry, warn after 10 attempts) already matches `Lock.js`. If its interface doesn't fit cleanly, adapt `Lock.js` rather than falling back to a standalone port.
4. Reuse `core/lib/RepoPath.js`'s `validate` (the `repo_path_enter` native equivalent, landed in #233) for argument validation.
5. Add a parity test at `core/spec/bin/issueStateParity_spec.js` (new file, following the `checkoutSafeBranchParity_spec.js`/`resolvePlanPathsParity_spec.js` convention — a dedicated `core/spec/bin/` file, not folded into the `core/spec/lib/` unit spec) that runs `issue_state_shell.sh` vs `core/bin/arcanum issue-state` with identical inputs across all four subcommands, asserting identical stdout, exit code, and resulting state file content. Usage/unknown-command error text may assert with `toContain` rather than exact equality, since the shell side's `$0`-based usage message isn't reproducible byte-for-byte by the native side (precedent: `permissionGrantParity_spec.js`).
6. Extend the existing `core/spec/lib/IssueState_spec.js` with unit tests for the new methods: missing field on `get`, overwriting an existing field, `set-json` with objects vs arrays, `append-json` on a field that doesn't exist yet vs. already an array, concurrent-write lock contention.
7. Flip `issue-state` from `false` to `true` in `arcanum/_lib/migration-status.json`.
8. Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
9. Zero runtime npm dependencies — only built-in Node APIs.

### Agent assignments

| Agent | Scope |
|---|---|
| `node` | `IssueState.js` methods, `Lock.js` reuse, unit tests, parity test, command registry |
| `scripter` | Shim/dispatch wiring in `arcanum/_lib/issue_state.sh` |
| `architect` | `migration-status.json` flip and migration-status doc regeneration |

## Benefits

- Completes the full native build for `issue-state`, closing out the remaining gap in `core/lib/IssueState.js` left by #232's original scope.
- Removes a second, near-duplicate inline lock implementation by consolidating onto `core/lib/Lock.js`.
- Continues the shell → native migration batch with consistent momentum (#192, #193, #227, #233, #234, #235).
