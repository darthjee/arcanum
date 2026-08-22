## Context

Part of the migration batch tracked in #232 (following #192, #193, #227). Migrates `arcanum/_lib/resolve_plan_paths.sh` to native Node.js.

## Target script

`arcanum/_lib/resolve_plan_paths.sh` — resolves the issue file and plan dir/file for a given issue ID.

**Current usage:** `resolve_plan_paths.sh <issues_folder> <plans_folder> <id>`

**Output contract (key=value lines):**
```
ISSUE_FILE=<path>
PLAN_DIR=<path>
PLAN_FILE=<path>
PLAN_EXISTS=true|false
```

**Error cases (stderr, exit 1):**
- Missing required arg: `Usage: $0 <issues_folder> <plans_folder> <id>`
- `id` not numeric: `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.`
- No issue file found for `id` (searches `<issues_folder>/<id>_*` and `<id>-*`, `-maxdepth 1`): `Error: no issue file found for id <id>`

**Side effect:** creates `PLAN_DIR` (`mkdir -p`) on success.

## Dependencies

No `_lib` sourced dependencies today — it receives `issues_folder`/`plans_folder` as plain arguments and does its own `find`-based lookup via an internal `find_existing_file` helper. This is the simplest of the seven targets in terms of internal logic, but it's also the only one of the seven with **no existing `engine_dispatch` shim** — unlike `resolve_id_and_file.sh`/`list_agents.sh`/`checkout_safe_branch.sh`, `resolve_plan_paths.sh` today has no shell/native routing split at all, and no `repo_path` argument. Building its shim for the first time is part of this issue's scope (see "Repo path threading" below).

## Migration contract

Following the pattern from #227/PR #228 (see `core/lib/ResolveIdAndFile.js` as the closest existing reference implementation):

- Native implementation at `core/lib/ResolvePlanPaths.js`, routed via `core/bin/arcanum resolve-plan-paths` (one new entry in `core/bin/arcanum`'s `COMMANDS` registry: `'resolve-plan-paths': { module: 'ResolvePlanPaths.js', method: 'run' }`)
- **Reuse `core/lib/IssueFile.js`'s `IssueFile.findExisting(repoPath, issuesFolder, id)`** for the issue-file lookup instead of reimplementing the `<id>_*`/`<id>-*` glob — it already matches `find_existing_file`'s exact semantics (same globs, same first-match-wins, same single-directory scope, same `<issuesFolder>/<filename>` return shape)
- Byte-identical output/exit-code to `resolve_plan_paths.sh`'s core logic (same four `KEY=value` lines, same `Error:` messages, same exit codes, same `mkdir -p` side effect). The `Usage:` guard stays shell-shim-only (see below) — no native/parity coverage for it, consistent with every prior migration.
- Zero runtime npm dependencies — only built-in Node APIs
- Flip `resolve-plan-paths` from `false` to `true` in `arcanum/_lib/migration-status.json` (key already present)
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`

### Tests

- Unit tests at `core/spec/lib/ResolvePlanPaths_spec.js` — edge cases: non-numeric id, no matching issue file, plan file already exists vs. doesn't
- Parity test at `core/spec/bin/resolvePlanPathsParity_spec.js` (**not** under `spec/lib/` — that convention holds for the unit spec only; the shell-vs-native parity spec lives under `spec/bin/`, per `core/spec/bin/resolveIdAndFileParity_spec.js`'s established split) — runs the renamed shell implementation directly (not through the new shim, to avoid circularity) vs. `core/bin/arcanum resolve-plan-paths`, asserting identical stdout + exit code

### Repo path threading (new shim + ripple)

Creating `resolve_plan_paths.sh`'s first-ever `engine_dispatch` shim requires `repo_path` as a new required leading positional argument, purely so `engine_dispatch` can resolve `engine.mode` via `config_chain_read` — even though the script's own filesystem-only logic never needed it. This follows the existing `resolve_id_and_file.sh`/`resolve_id_and_file_shell.sh` split:

- Rename the current shell implementation to `arcanum/_lib/resolve_plan_paths_shell.sh` (logic unchanged)
- Add a new thin shim at `arcanum/_lib/resolve_plan_paths.sh`: `Usage: resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>`, sourcing `engine_dispatch.sh` (this is where the `Usage:` stderr message above now lives — shim-only, never reaching `core/`)
- New signature: **`resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>`** (repo_path added as the new leading arg)

This is a decided scope inclusion (confirmed during issue discussion) — the ripple is bounded and goes into this issue rather than a follow-up:

- The two thin per-skill wrapper scripts (`auto-plan-issue/scripts/resolve_plan_paths.sh`, `auto-fix-issue/scripts/resolve_plan_paths.sh`) need **no changes** — both already `exec ... "$@"` through unchanged regardless of arg count.
- Update the call sites (prose + example commands) in these 4 `steps/*.md` files to pass `$REPO_PATH` as the new leading arg:
  - `plan-issue/steps/file_definition.md`
  - `auto-plan-issue/steps/run.md`
  - `auto-fix-issue/steps/run.md`
  - `auto-fix-all/steps/process_one_issue.md` (two occurrences)

## References

- Parent: #232
- Migration design: docs/agents/architecture/script-engine.md
- Repo path threading convention: docs/agents/architecture/repo-path-threading.md
- Previous migrations: #192, #193, #227
