# Plan: Fix bump release

Issue: [133-fix-bump-release.md](../issues/133-fix-bump-release.md)

## Overview

`scripts/bump-version.sh` always renames `arcanum/migrations/repos/next/` to `arcanum/migrations/repos/<new-version>/`, even when `next/` has no pending migrations — leaving stale empty version folders (e.g. `0.10.0/`) that `/arcanum-migrate` then wrongly offers as pending. This plan adds an emptiness check that skips the rename when `next/` has nothing but `.keep`, and removes the existing stale `0.10.0/` folder.

## Context

- `next/` holds unreleased, pending per-repo migrations; `bump-version.sh` rolls it into `<new-version>/` on every bump so a migration ships in the same release as the change it belongs to.
- `arcanum/migrations/select_version.sh` / `_pending_versions.sh` treat any version-looking folder under `repos/` (excluding `next`) as a pending migration to offer — with no check for whether it actually contains any migration files. An empty version folder is therefore indistinguishable from a real one to that logic.
- `arcanum/migrations/repos/0.10.0/` already exists today with only a `.keep` file inside — a stale artifact from a prior bump where `next/` was empty. `arcanum/migrations/repos/0.9.3/` shows what a real, non-empty version folder looks like (`.keep`, `001.md`, `001.sh`).
- No test coverage is planned for this fix (explicitly declined during issue refinement).

## Implementation Steps

### Step 1 — Add an emptiness helper

In `scripts/bump-version.sh`, add a helper function:

```bash
is_migrations_dir_empty() {
  local dir="$1"
  [[ -z "$(find "$dir" -mindepth 1 ! -name '.keep')" ]]
}
```

"Empty" means the directory has no entries other than `.keep` — any other file or subdirectory counts as non-empty (so unexpected artifacts are never silently discarded), and a directory missing `.keep` entirely also counts as empty.

### Step 2 — Branch the rename on emptiness

Replace the current unconditional block:

```bash
if [[ -d "$VERSION_MIGRATIONS_DIR" ]]; then
  echo "Error: ${VERSION_MIGRATIONS_DIR} already exists — refusing to overwrite." >&2
  exit 1
fi
if [[ ! -d "$NEXT_MIGRATIONS_DIR" ]]; then
  echo "Error: ${NEXT_MIGRATIONS_DIR} is missing — expected it to always exist." >&2
  exit 1
fi

mv "$NEXT_MIGRATIONS_DIR" "$VERSION_MIGRATIONS_DIR"
mkdir -p "$NEXT_MIGRATIONS_DIR"
touch "${NEXT_MIGRATIONS_DIR}/.keep"
```

with:

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

Key point: the "`<version>` already exists" guard stays **unconditional**, running before the empty/non-empty branch — a stray pre-existing `<version>/` dir is still caught as an error regardless of whether `next/` is empty.

### Step 3 — Update the trailing summary output

The script's final `echo` lines (after the block above) unconditionally say the migrations dir was moved and recreated. Since that's now only true in the non-empty branch, move those two `echo` lines (`"Moved ${NEXT_MIGRATIONS_DIR} -> ..."` and any combined summary referencing the move) inside the `else` branch from Step 2 — the code above already does this — and double check nothing further down the script still assumes the move always happened (e.g. no other message after the `if/else` references `VERSION_MIGRATIONS_DIR` as freshly created).

### Step 4 — Remove the stale `0.10.0/` folder

Delete the existing `arcanum/migrations/repos/0.10.0/` directory (currently only `.keep`) as a one-off cleanup in this same change — `rm -rf arcanum/migrations/repos/0.10.0`. This is a manual, one-time fix; no script or migration is added to detect/remove stale empty version folders going forward, since the Step 1–2 fix prevents new ones from being created.

## Files to Change

- `scripts/bump-version.sh` — add `is_migrations_dir_empty`, branch the rename/recreate logic on it, keep the existing-version-dir guard unconditional.
- `arcanum/migrations/repos/0.10.0/` — delete (stale, empty folder; one-off cleanup, not code).

## Notes

- Edge cases already reasoned through and covered by this design:
  - `next/` missing entirely → still errors (unconditional check, unchanged).
  - `<new-version>/` already exists on disk → still errors, regardless of whether `next/` is empty or not.
  - Running the script twice in a row → second run finds a freshly-empty `next/` → takes the skip branch, no stale dir created.
- No dedicated test coverage for this fix (explicitly out of scope per the issue).
- No migration is needed for consuming repos — this is tooling-only, internal to this repo's release process.
