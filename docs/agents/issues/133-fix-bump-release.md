# Issue: Fix bump release

## Description

`scripts/bump-version.sh` unconditionally renames `arcanum/migrations/repos/next/` to `arcanum/migrations/repos/<new-version>/` on every version bump, then recreates an empty `next/` with a `.keep` placeholder.

## Problem

Sometimes `next/` is empty at bump time (i.e. no pending per-repo migrations were added since the last release) — this already happened for `0.10.0`, which today contains only `.keep`. When that happens, the rename still runs, leaving behind a stale, empty version folder. This is more than cosmetic: `arcanum/migrations/select_version.sh` / `_pending_versions.sh` treat any version-looking folder under `repos/` as pending, so repos running `/arcanum-migrate` are offered `0.10.0` as a pending migration even though it has nothing to run.

## Expected Behavior

When `next/` is empty at bump time, the script skips the rename (and the recreate-empty-`next/`-with-`.keep` step, since `next/` is already in that state) — `next/` is left untouched instead of being moved to `<new-version>/`.

"Empty" means: the directory contains no entries other than `.keep`. Any other file or subdirectory (regardless of naming) counts as non-empty, so unexpected artifacts are never silently discarded. A directory missing `.keep` entirely also counts as empty (nothing to preserve).

The existing stale `arcanum/migrations/repos/0.10.0/` (empty, only `.keep`) is removed as part of this fix.

## Solution

Add an `is_migrations_dir_empty` helper:

```bash
is_migrations_dir_empty() {
  local dir="$1"
  [[ -z "$(find "$dir" -mindepth 1 ! -name '.keep')" ]]
}
```

Update the control flow in `scripts/bump-version.sh`:

```bash
if [[ -d "$VERSION_MIGRATIONS_DIR" ]]; then
  echo "Error: ${VERSION_MIGRATIONS_DIR} already exists — refusing to overwrite." >&2
  exit 1
fi
if [[ ! -d "$NEXT_MIGRATIONS_DIR" ]]; then
  echo "Error: ${NEXT_MIGRATIONS_DIR} is missing — expected it to always exist." >&2
  exit 1
fi

if is_migrations_dir_empty "$NEXT_MIGRATIONS_DIR"; then
  touch "${NEXT_MIGRATIONS_DIR}/.keep"   # defensive: keep it git-trackable even if .keep was missing
  echo "No pending migrations in ${NEXT_MIGRATIONS_DIR} — skipping rename."
else
  mv "$NEXT_MIGRATIONS_DIR" "$VERSION_MIGRATIONS_DIR"
  mkdir -p "$NEXT_MIGRATIONS_DIR"
  touch "${NEXT_MIGRATIONS_DIR}/.keep"
  echo "Moved ${NEXT_MIGRATIONS_DIR} -> ${VERSION_MIGRATIONS_DIR} and recreated an empty ${NEXT_MIGRATIONS_DIR}."
fi
```

The "`<version>` already exists" guard stays unconditional (runs before the empty/non-empty split) — a stray pre-existing `<version>/` dir is still caught as an error even when `next/` turns out to be empty.

Edge cases handled by this design:

- `next/` missing entirely → still errors (unconditional check, unchanged).
- `<new-version>/` already exists on disk → still errors, regardless of whether `next/` is empty or not.
- Running the script twice in a row → second run finds a freshly-empty `next/` (just recreated with `.keep`) → takes the skip branch, no stale dir created.

Additionally, remove the existing stale `arcanum/migrations/repos/0.10.0/` (empty, only `.keep`) as a one-off `rm -rf` in this PR — not via a script or migration, since once `bump-version.sh` is fixed this situation cannot recur.

No dedicated test coverage is planned for this fix.

## Benefits

- No more stale empty version folders left behind by version bumps where no per-repo migration was pending.
- `/arcanum-migrate` no longer offers phantom pending versions with nothing to run.
- `next/` stays git-trackable via `.keep` in both branches.
