# Issue: Migrate next entry point to use native nodejs

## Description

Migrate the `resolve_id_and_file.sh` entry point to the native Node.js engine, as the second real (non-fixture) entry point migration — following `resolve-and-fetch` (#193) — under the shell → Node.js migration described in [docs/agents/architecture/script-engine.md](docs/agents/architecture/script-engine.md).

`resolve_id_and_file.sh` (canonical copy in `arcanum/_lib/`, delegated to by thin wrappers at `discuss-issue/scripts/resolve_id_and_file.sh` and `auto-new-issue/scripts/resolve_id_and_file.sh`) resolves issue IDs, titles, and filenames from skill arguments and the local issues folder. It is purely filesystem-based (`find`/`basename`/string manipulation) — no `gh`/GitHub API dependency — which keeps this migration's testing filesystem-only, with no network mocking required.

Also establish a centralized `docs/agents/architecture/entrypoint-migration-status.md` document tracking migration status across all entry points, replacing the ad hoc status table that otherwise lives only in an issue body.

## Problem

Only `resolve-and-fetch` has been migrated to native Node.js so far (plus the `dispatch-fixture`/`dispatch-fixture-crash` test fixtures). `resolve_id_and_file.sh` is the next entry point due for migration, and there is currently no single place that tracks which entry points have been migrated and which remain on shell — that status currently only lives inside individual migration issues.

## Expected Behavior

The native implementation must be byte-identical to the shell implementation in stdout and exit code (per the script-engine.md output contract), for all three scenarios:

- **Scenario A** — ID and title provided (e.g. `#123 Title`).
- **Scenario B** — title only provided (missing ID).
- **Scenario C** — ID only provided (title extracted from the matching file's name).

Output contract (unchanged from the current shell script):

```
SCENARIO=A|B|C
ID=<id or empty>
TITLE=<title or empty>
FILE=<path or empty>
STATUS=existing|new|missing_id
NEEDS_FETCH=true    (only when GitHub fetch is required, i.e. STATUS=new with an id)
```

## Solution

1. Extract the current shell implementation to `arcanum/_lib/resolve_id_and_file_shell.sh` as the fallback (existing callers — the `discuss-issue` and `auto-new-issue` wrapper scripts — keep delegating to `arcanum/_lib/resolve_id_and_file.sh` unchanged, since they already just `exec` the canonical copy).
2. Convert `arcanum/_lib/resolve_id_and_file.sh` into a thin `engine_dispatch.sh` shim, following the `resolve_and_fetch.sh` pattern.
3. Implement the native logic in `core/lib/ResolveIdAndFile.js`, handling Scenarios A/B/C above.
4. Register the new `resolve-id-and-file` command in the `COMMANDS` registry in `core/bin/arcanum`, and add its entry to `arcanum/_lib/migration-status.json`.
5. Add unit tests plus a shell-vs-native parity test (per script-engine.md's testing conventions).
6. Add `scripts/generate_entrypoint_migration_status.sh` — dev tooling alongside `scripts/bump-version.sh`/`scripts/generate_tags_table.sh` (not a skill script) — that regenerates `docs/agents/architecture/entrypoint-migration-status.md` from `arcanum/_lib/migration-status.json`, and wire it into `scripts/bump-version.sh` the same way `generate_tags_table.sh` already is, so the doc self-heals at every release even if nobody ran it manually mid-cycle.
7. Verify the delegation chain still works end-to-end through `auto-new-issue/steps/run.md` and `discuss-issue/scripts/resolve_id_and_file.sh`.

### Reuse opportunity (evaluate, not required)

`core/lib/ResolveAndFetch.js` already has `_titleFromFilename`/`_findExistingFile`-equivalent logic. Extracting shared filename/lookup helpers into a new `core/lib/IssueFile.js` would avoid duplicating that logic — worth doing if it falls out naturally, but not a hard requirement of this issue.

### Agent assignments

| Agent | Scope |
|---|---|
| `node` | Core logic, unit tests, parity tests, command registry |
| `scripter` | Shim creation and shell implementation extraction |
| `skill-writer` | Verification/adjustment of skill step files |
| `architect` | `generate_entrypoint_migration_status.sh`, its `bump-version.sh` wiring, and the resulting doc |

## Benefits

- Continues the shell → native migration with the next production entry point, keeping momentum consistent with #193.
- A centralized migration status doc, generated from `arcanum/_lib/migration-status.json` and self-healed on every `bump-version.sh` run (same precedent as `tag-mutations.md`), replaces status tables scattered across individual issues without risking drift.
- Filesystem-only scope (no GitHub API) keeps this migration's tests simple and fully offline.
