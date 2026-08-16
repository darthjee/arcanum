# Plan: Add global migration mechanism

Issue: [166-add-global-migration-mechanism.md](../issues/166-add-global-migration-mechanism.md)

## Overview

Add `applies_to: "global"` as a third scope in the per-repo migration manifest (`arcanum/migrations/repos/<version>/migrations.json`), alongside the existing `"repo"`/`"local"`. A `"global"`-scoped entry is satisfied once `.migrations.version` inside the global config file (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`, shipped by #160's `arcanum/_lib/global_config.sh`) reaches the entry's version folder — shared machine-wide, not per-clone. Ship alongside a no-op seed migration that safely proves the new plumbing on real installs before anything consequential relies on it.

## Context

`arcanum/migrations/`'s dual-pointer scheme (`_manifest.sh`, `_pending_versions.sh`, `update_per_version.sh`, `run.sh`, `select_version.sh`) already threads `"repo"`/`"local"` scopes end-to-end. Issue #160 (PR #171) added `arcanum/_lib/global_config.sh` (read/write the global file, lock-protected, degrades silently) and `arcanum/_lib/config_chain.sh`, but never touched the migration manifest schema — `arcanum/migrations/repos/next/001.sh` (the one migration writing to the global file today) works around the gap with `applies_to: "local"` + hand-rolled idempotency. `_manifest_has_scope` (in `_manifest.sh`) is already scope-agnostic (plain string compare), so it needs no change — everything else that currently hardcodes exactly two scopes needs a third arm.

## Implementation Steps

### Step 1 — Add version-pointer helpers to `arcanum/_lib/global_config.sh`

Add two new public functions, reusing `repo_config_get_version`/`repo_config_set_version` (from `arcanum/_lib/repo_config.sh`, which this file must now also source) against the resolved global file path, namespaced `migrations` (same `.migrations.version` shape the local file already uses):

- `global_config_get_version <repo_path>` — resolves `_global_config_file`; if empty (unresolvable location), prints nothing and returns 0 (same silent-degrade philosophy as every other function in this file — the loud/hard-error behavior for migrations specifically belongs in `update_per_version.sh`, not here, since this file is a general-purpose config-tier helper other future callers may use without wanting a hard error). Otherwise: `repo_config_get_version "$(_global_config_file)" migrations`.
- `global_config_set_version <repo_path> <version>` — same resolve step; if unresolvable, warns on stderr and returns 0 (mirrors `global_config_write`'s existing degrade-on-write behavior). Otherwise: `repo_config_set_version "$(_global_config_file)" "$version" migrations`.

`_global_config_file` stays private (leading underscore) but is already freely called by other sourcing scripts in this codebase (e.g. `_manifest_entries`, `_pending_versions` are used the same way across files) — `update_per_version.sh` will call it directly in Step 6 to detect the unresolvable case.

### Step 2 — Update `arcanum/migrations/_manifest.sh`'s schema documentation

Update the header comment's schema example and the `"applies_to"` field description to document `"global"` as a third valid value, with its own paragraph describing what pointer it's satisfied against (parallel to the existing `"repo"`/`"local"` paragraph) — reference `global_config_get_version`/`global_config_set_version` from Step 1. No code change to `_manifest_has_scope` itself (already scope-agnostic), just doc comment.

### Step 3 — Extend `arcanum/migrations/_pending_versions.sh`

Change `_pending_versions <committed_version> <local_version>` to `_pending_versions <committed_version> <local_version> <global_version>`, adding a third branch mirroring the existing two:

```bash
elif _manifest_has_scope "$dir" global && _version_gt "$base" "$global_version"; then
  echo "$base"
```

Update the header comment. **Both call sites (`run.sh`, `select_version.sh`) must be updated in the same change** — under `set -euo pipefail` an unset third positional would break `_version_gt`'s comparison, not silently no-op.

### Step 4 — Update `arcanum/migrations/run.sh`

- Source `arcanum/_lib/global_config.sh` alongside the existing `repo_config.sh` source.
- Add `_resolve_current_global_version`, mirroring `_resolve_current_version`/`_resolve_current_local_version`'s exact shape: calls `global_config_get_version "$REPO_PATH"`; if empty, warns ("no global version found ... treating as 0.0.0 for pending-version listing; any \"global\"-scoped entries reached during apply will hard-error until the global config location is resolvable") and echoes `0.0.0`; if present but not valid semver, errors and returns 1 — same as the other two. This fallback-to-0.0.0-with-a-warning approach means an unresolvable location doesn't crash version *listing*; the hard, entry-level stop happens later, in Step 6, only if a `"global"`-scoped entry is actually reached.
- Thread the resolved global version into every `_pending_versions` call (now 3 args) and into every `select_version.sh`/`update_per_version.sh` invocation this script makes, the same way committed/local already flow through.
- Update the header comment's "Reads two version pointers" section to "three version pointers."

### Step 5 — Update `arcanum/migrations/select_version.sh`

Same treatment as Step 4's `run.sh` changes, scoped to this file: source `global_config.sh`, re-resolve the global version on every loop iteration (mirroring `CURRENT_VERSION`/`CURRENT_LOCAL_VERSION`'s per-iteration re-read, since a prior iteration may have advanced it), pass the third arg into `_pending_versions`.

### Step 6 — Update `arcanum/migrations/update_per_version.sh`

Source `global_config.sh`. Resolve `GLOBAL_VERSION` the same way `COMMITTED`/`LOCAL_VERSION` are resolved today (default `0.0.0` if empty).

In the entry loop:
- `[[ "$applies_to" == "global" ]] && HAS_GLOBAL_ENTRY=true`
- Satisfied-check gets a third arm: `elif [[ "$applies_to" == "global" ]] && ! _version_gt "$VERSION" "$GLOBAL_VERSION"; then satisfied=true`
- **Unresolvable-location hard error, scoped only to `"global"` entries**: when an entry's `applies_to == "global"` is *not* satisfied (per the arm above) but `_global_config_file` resolves to empty, print a clear error to stderr (e.g. `Error: cannot resolve the global config location (no $HOME or CLAUDE_CONFIG_DIR) — "global"-scoped entry <id> in version <VERSION> cannot be processed.`), set a new `GLOBAL_ENTRY_UNRESOLVABLE=true` flag, and `continue` (exclude the entry from `ENTRY_*` — never shown, never run) instead of adding it to the to-run list. Do **not** `exit` — `"repo"`/`"local"` entries in the same manifest must still be collected and processed normally.

In `_advance_pointers`, add a third arm mirroring the existing two, but **gated by the new flag** so an unresolvable-location skip never falsely marks the version as globally done:

```bash
if [[ "$HAS_GLOBAL_ENTRY" == true && "$GLOBAL_ENTRY_UNRESOLVABLE" == false ]]; then
  local cur
  cur="$(global_config_get_version "$REPO_PATH")"
  cur="${cur:-0.0.0}"
  if _version_gt "$VERSION" "$cur"; then
    global_config_set_version "$REPO_PATH" "$VERSION"
  fi
fi
```

(If the location later becomes resolvable, the entry stays correctly pending and gets picked up on a future run — the pointer was never advanced past it.)

Update the header comment throughout (two-pointer → three-pointer language, matching Steps 4–5's updates elsewhere).

### Step 7 — Update `arcanum/migrations/generate_next.sh`'s header comment

No functional/code change needed — `APPLIES_TO_DEFAULT="local"` is just a scaffolded default the author already hand-edits after generation (this script has never validated `applies_to` against an enum). Update the header comment to mention `"global"` as a value an author may set by hand, alongside the existing `"local"`/`"repo"` mention.

### Step 8 — Add the seed/no-op migration

Add entry `"002"` to `arcanum/migrations/repos/next/migrations.json`:

```json
{"id": "002", "type": "script", "file": "002.sh", "skippable": true, "applies_to": "global"}
```

Create `arcanum/migrations/repos/next/002.sh` (same `config`/`run` skeleton contract as `001.sh` — `cmd_config` prints `{"skippable": true}`; `cmd_run` does nothing but `exit 0`) and `arcanum/migrations/repos/next/002.md` (human-facing description: this entry's sole purpose is to initialize `.migrations.version` in the global config file for every install now that `"global"` exists as a real scope — no other effect, safe to re-run, proves the new plumbing end-to-end on real installs before any consequential global-effect migration depends on it).

### Step 9 — Update docs

- `docs/agents/architecture/per-repo-migrations.md` — describe the third scope/pointer, referencing `global_config_get_version`/`global_config_set_version` and the unresolvable-location hard-error behavior.
- `docs/guides/arcanum-repo-version.md` — extend "Two pointers, not one" into a three-pointer story; add `"global"`'s bullet alongside `"repo"`/`"local"`'s.
- `docs/guides/arcanum-global-config.md` — note the global file now also carries a `.migrations.version` pointer for `"global"`-scoped per-repo migrations, cross-reference the two guides above.

## Files to Change

- `arcanum/_lib/global_config.sh` — add `global_config_get_version`/`global_config_set_version`, source `repo_config.sh`.
- `arcanum/migrations/_manifest.sh` — doc comment only.
- `arcanum/migrations/_pending_versions.sh` — third parameter + branch.
- `arcanum/migrations/run.sh` — resolve + thread global pointer.
- `arcanum/migrations/select_version.sh` — resolve + thread global pointer.
- `arcanum/migrations/update_per_version.sh` — `HAS_GLOBAL_ENTRY`, satisfied-check arm, unresolvable hard-error handling, `_advance_pointers` arm.
- `arcanum/migrations/generate_next.sh` — doc comment only.
- `arcanum/migrations/repos/next/migrations.json` — add entry `002`.
- `arcanum/migrations/repos/next/002.sh`, `arcanum/migrations/repos/next/002.md` — new seed migration.
- `docs/agents/architecture/per-repo-migrations.md`, `docs/guides/arcanum-repo-version.md`, `docs/guides/arcanum-global-config.md` — three-pointer documentation.

## Notes

- **Out of scope** (per the issue): converting existing `001.sh` from `applies_to: "local"` to `applies_to: "global"`. It keeps working as-is.
- **Cross-repo write races** and the **`type: "instructions"` + `applies_to: "global"` mid-manifest resume** case are accepted as best-effort at the framework level (see issue's Edge Cases) — no additional cross-process locking beyond what `global_config_write`/`global_config_set_version` already provide. Future authors of `"global"`-scoped entries are responsible for considering this race for their specific entry.
- **Multi-profile behavior** (an already-satisfied global entry looking pending again under a different `CLAUDE_CONFIG_DIR`) is intended, not a bug — worth a one-line callout in the doc updates in Step 9 so it isn't misreported later.
- No CI job in `.circleci/config.yml` covers these paths (it only builds/releases on a tag push) — no `## CI Checks` section applies.
