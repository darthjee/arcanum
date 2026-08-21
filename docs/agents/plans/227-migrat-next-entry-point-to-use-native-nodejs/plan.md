# Plan: Migrate next entry point to use native nodejs

Issue: [227-migrat-next-entry-point-to-use-native-nodejs.md](../issues/227-migrat-next-entry-point-to-use-native-nodejs.md)

## Overview

`resolve_id_and_file.sh` gets a native Node.js implementation dispatched via `engine_dispatch.sh`, the second real (non-fixture) entry point migration after `resolve-and-fetch` (#193), following the exact same shim/native/parity-test shape. `scripter` extracts the current shell logic into a fallback file and converts the canonical script into a thin dispatch shim; `node` builds the native equivalent, its unit tests, and the parity test that proves the two match byte-for-byte. Separately, and not part of the shim/native split, `architect` adds a small generator script that derives `docs/agents/architecture/entrypoint-migration-status.md` from `arcanum/_lib/migration-status.json`, wired into `scripts/bump-version.sh` so the doc self-heals on every release (same precedent as `docs/agents/tag-mutations.md`/`scripts/generate_tags_table.sh`).

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

**Command key**: `resolve-id-and-file` (kebab-case) — used as the third argument to `engine_dispatch` in the shell shim, as the routing key in `core/bin/arcanum`, and as the key added to `arcanum/_lib/migration-status.json` once everything passes.

**Stdout/exit-code contract** (both sides must produce this byte-for-byte, for all inputs):

```
SCENARIO=A|B|C
ID=<id or empty>
TITLE=<title or empty>
FILE=<path or empty>
STATUS=existing|new|missing_id
NEEDS_FETCH=true    (only when GitHub fetch is required, i.e. STATUS=new with an id)
```

- **Scenario A** (`#<id> <title>` or `#<id> - <title>`) — id + title both provided. Existing-file match → `STATUS=existing` with the matched `FILE`. No match → `STATUS=new`, `NEEDS_FETCH=true`, `FILE` = `<issues_folder>/<id>_<snake_case_title>.md`.
- **Scenario B** (a bare title, no leading `#`) — `STATUS=missing_id`, `ID=`/`FILE=` empty.
- **Scenario C** (`#<id>` alone, no title) — existing-file match → `STATUS=existing`, `TITLE` derived from the matched filename. No match → `STATUS=new`, `NEEDS_FETCH=true`, `ID`/`FILE`/`TITLE` per the shell script's current Scenario C shape (`TITLE` empty).

**Hard-failure precondition** (outside the `STATUS=`/output contract, same class as `checkout_safe_branch.sh`'s dirty-tree failure): a non-empty `ID` that isn't `^[0-9]+$` prints `Error: issue id must be numeric and linked to a GitHub issue (got '<id>'). Local-only ids are no longer supported.` to stderr and exits 1 — no `STATUS=` line at all.

**Existing-file lookup**: glob `<issues_folder>/<id>_*` or `<issues_folder>/<id>-*`; first match wins. Match order is filesystem-dependent and not required to be identical between shell and native (same caveat as #193) — do not build fixtures with more than one match for the same id.

**Filename sanitization** (Scenario A's fresh `FILE=` guess, `title_to_snake_case`): lowercase, `[^a-z0-9]` → `_`, collapse repeated `_`, trim leading/trailing `_`. Result: `<issues_folder>/<id>_<slug>.md`.

**`TITLE` derivation for an existing-file match** (`title_from_filename`): strip the `<id>` prefix up to the first `_`/`-`, replace remaining `_`/`-` with spaces, Title-Case each word.

**No network/GitHub dependency**: unlike `resolve-and-fetch`, this entry point is purely filesystem-based — no `gh auth token`, no `fetch`, no `HOME` needed in the `engine_dispatch` env allowlist beyond the `PATH` it always includes.

**Gating**: `scripter`'s final step (flip `resolve-id-and-file` to `true` in `migration-status.json`) only happens once `node`'s unit tests, parity test, and code review all pass — sequenced last, after `node`'s work is already committed on this same branch. `architect`'s doc-generation step (below) runs last of all, after the flip, so the initial `entrypoint-migration-status.md` reflects the finished migration.

## Architect steps (done directly, not dispatched — root-level `scripts/` and `docs/agents/architecture/**` are architect's own scope)

### Step 1 — Add the generator script and wire it into `bump-version.sh`

Add `scripts/generate_entrypoint_migration_status.sh`, following `scripts/generate_tags_table.sh`'s conventions (self-locates via `SCRIPT_DIR`, no `repo_path` argument — dev tooling that only ever analyzes arcanum's own tree, not a target repo; default non-interactive regeneration). It reads `arcanum/_lib/migration-status.json` and renders `docs/agents/architecture/entrypoint-migration-status.md` as a table of every key in the map (command, migrated?, and — where knowable from git history/plan folders — the issue that migrated it; entries whose provenance can't be resolved get a blank issue column rather than a guess). Wire the call into `scripts/bump-version.sh` immediately after its existing `generate_tags_table.sh` call, so the doc self-heals at every release even if nobody ran it manually mid-cycle, exactly like `tag-mutations.md` already does.

### Step 2 — Generate and commit the initial doc

Once `scripter`'s migration-status flip (below) is committed on this branch, run the new script once and commit the resulting `docs/agents/architecture/entrypoint-migration-status.md`, so the first version already reflects `resolve-and-fetch` and `resolve-id-and-file` both migrated.

## Files to Change

- `scripts/generate_entrypoint_migration_status.sh` (new) — architect.
- `scripts/bump-version.sh` — add the call, architect.
- `docs/agents/architecture/entrypoint-migration-status.md` (new, generated) — architect.

## Notes

- No `## CI Checks` for the architect steps: like `generate_tags_table.sh`, there's no CI job enforcing this doc stays in sync today (the tag-mutations table only gets a non-blocking `check_tags_table.sh` job) — out of scope to add one here.
- The `IssueFile.js`-style shared-helper extraction mentioned during discussion (reusing `core/lib/ResolveAndFetch.js`'s filename/lookup logic) is optional — see `node.md`'s Notes. Not a requirement of this issue.
