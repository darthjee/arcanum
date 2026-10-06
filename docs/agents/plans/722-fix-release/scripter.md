# Scripter Plan: Fix release

Main plan: [plan.md](plan.md)

## Shared contracts

- **Reference pattern:** ERE `repos/next/[0-9]{3}([^0-9]|$)`. Rewrite `repos/next/NNN` → `repos/<new-version>/NNN`.
- **Scope:** `core/spec/**`, `docs/**`, `README.md`; exclude `docs/agents/issues/**` and `docs/agents/plans/**`. Never scan `scripts/`, `arcanum/`, `core/node_modules/`.
- **Guard:** a reference to `NNN` is stale when `arcanum/migrations/repos/next/` has no `NNN.*` file. Check it before writing anything. On any stale reference, print `<path>:<line>: <match>` lines to stderr and `exit 1`.
- **Rewrite:** only when `next/` is actually moved (the existing non-empty branch), only for moved `NNN`s.

## Implementation Steps

### Step 1 — Guard and rewrite in `scripts/bump-version.sh`

`scripts/bump-version.sh` is a root-level repo script, not a skill script. It's bash, though, so it falls to `scripter`.

1. Add a helper that lists in-scope files, e.g. `find "$REPO_ROOT/core/spec" "$REPO_ROOT/docs" "$REPO_ROOT/README.md" -type f` with `-path "$REPO_ROOT/docs/agents/issues" -prune` and `-path "$REPO_ROOT/docs/agents/plans" -prune`. Also prune any `node_modules`. Tolerate missing roots (a fixture may not have `core/spec`).
2. **Guard.** Run it right after `NEW_VERSION`/`NEXT_RELEASE` are validated and computed, and **before** the `echo "$NEW_VERSION" > "$VERSION_FILE"` write. Also move the two existing pre-checks (`VERSION_MIGRATIONS_DIR` already exists / `NEXT_MIGRATIONS_DIR` missing) up to this point, so a failed bump never leaves a half-written tree. For each in-scope file, `grep -nE 'repos/next/[0-9]{3}([^0-9]|$)'` and extract each `NNN`. If `NEXT_MIGRATIONS_DIR` has no file matching `NNN.*`, record `<relative path>:<line>: repos/next/NNN`. If any were recorded, print a header (`Error: stale arcanum/migrations/repos/next/NNN references — fix them before bumping:`) and the hits to stderr, then `exit 1`.
3. **Rewrite.** In the existing `else` branch, **after** `mv "$NEXT_MIGRATIONS_DIR" "$VERSION_MIGRATIONS_DIR"`, collect the moved ids (`NNN` prefixes of the files now in `VERSION_MIGRATIONS_DIR`, excluding `migrations.json`). For each in-scope file that contains a match, run once per id: `sed -i.bak -E "s#repos/next/${id}([^0-9]|$)#repos/${NEW_VERSION}/${id}\1#g" "$file" && rm -f "$file.bak"`. This follows the script's existing BSD/GNU-portable `sed -i.bak` + `rm` pattern. Echo a summary line, e.g. `Rewrote repos/next/NNN references in N file(s).`
4. Update the header comment at the top of the script to describe the guard and the rewrite: scope, exclusions, and that only moved ids are rewritten.

### Step 2 — Regression test `scripts/test_bump_version.sh`

A new standalone bash test, following `scripts/test_generate_tags_table.sh`'s convention: `set -uo pipefail`, a `fail()` helper, a temp dir cleaned up on `EXIT`, run by hand, not wired into CI. Build fixture repos with:

- `scripts/bump-version.sh` copied in (it self-locates `REPO_ROOT` from `SCRIPT_DIR`); stub `scripts/generate_tags_table.sh` and `scripts/generate_entrypoint_migration_status.sh` as executable no-ops
- `arcanum.version` (e.g. `1.0.0`), `arcanum/install/bootstrap.sh` with a `DEFAULT_VERSION="1.0.0"` line, and a `README.md` with the Current Version / Next Release lines
- `arcanum/migrations/repos/next/` with `migrations.json` and the migration files for that case

Cases (bump to an explicit version, e.g. `1.1.0`):

1. **Rewrite.** `next/` holds `001.sh`, `001.md`, `002.md`, `002.instructions.md`. References appear in `core/spec/x_spec.js` (`'arcanum/migrations/repos/next/001.sh'`), in `docs/a.md` (`` `arcanum/migrations/repos/next/002` ``, bare), and in `README.md`. After the bump, all of them read `repos/1.1.0/...` and the files exist under `repos/1.1.0/`.
2. **Exclusions.** The same `repos/next/001.sh` text in `docs/agents/issues/1-x.md`, `docs/agents/plans/1-x/plan.md`, and `scripts/other.sh` is left unchanged. So is generic prose like `` `arcanum/migrations/repos/next/` holds unreleased migrations `` in `docs/a.md`.
3. **No partial match.** `repos/next/0010` in a doc doesn't trip the guard and isn't rewritten. Add `next/001.sh` so `001` is a real file and `0010` is the only possible false hit.
4. **Empty `next/`.** `migrations.json` is `[]` and no in-scope references exist. The bump succeeds and no doc changes.
5. **Stale reference aborts.** `next/` holds only `001.sh` and a doc cites `repos/next/005.sh`. The script exits non-zero, stderr names the file, line and `repos/next/005`, and **nothing** changed: `arcanum.version` still reads `1.0.0`, `next/` is still in place, and no `repos/1.1.0/` exists.

## Files to Change

- `scripts/bump-version.sh` — new guard (before any write), early pre-checks, rewrite after the move, refreshed header.
- `scripts/test_bump_version.sh` — new regression test (executable).

## CI Checks

None. `scripts/` isn't covered by a CI job, and `test_generate_tags_table.sh` isn't wired in either. Run locally: `bash scripts/test_bump_version.sh`.

## Notes

- Don't run `bump-version.sh` against the real repo. Exercise it only through the fixture test.
- On this branch the real `next/` is empty (`[]`). After the `architect` doc fixes there should be no in-scope `repos/next/NNN` references, so a future real bump passes the guard.
