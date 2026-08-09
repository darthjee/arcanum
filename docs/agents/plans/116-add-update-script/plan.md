# Plan: Add update script

Issue: [116-add-update-script.md](../../issues/116-add-update-script.md)

## Overview

Adds `arcanum/update/{bootstrap.sh,updater.sh}`, mirroring `arcanum/install/`'s two-stage curl|bash architecture, to reconcile an existing install with a target release: add new files, overwrite changed ones, delete files no longer part of the release. Reconciliation is driven by a `MANIFEST` file added to the release zip and a new `arcanum.json` metadata file (replacing the static `arcanum.version`) that installs write dynamically, tracking `version`, `repo` (so fork installs stay on their fork), and the currently-applied `manifest`. `installer.sh` is updated to redirect to `update` instead of refusing outright when an install already exists.

## Context

`install` (added in #114 / PR #115, commit 7941a69) can only perform a fresh install — `installer.sh` refuses if `arcanum.version` already exists at the target, with no update path. The full design — script location, invocation/version/target/repo resolution, the `arcanum.json` format, the add/delete manifest-diff mechanism, edge cases, rejected alternatives (git-native update for git-clone installs; `rsync --delete`), scope, and security considerations (path-traversal safety in the delete pass; temp-dir cleanup) — was already worked out in detail during `/enhance-issue` and `/discuss-issue` and is captured in full in the issue file linked above. This plan translates that design into concrete file changes.

A Claude-facing skill wrapper to invoke `update` from within Claude Code is explicitly out of scope — split out to **#117**.

No specialist agent has planning-time work here (`scripter`'s scope is `<skill-name>/scripts/`; none of this work touches a skill's own `scripts/` folder — it's all in `arcanum/install/`, `arcanum/update/`, root `scripts/`, and `docs/`), so this is a single plan with no agent split.

## Implementation Steps

### Step 1 — `scripts/build_release_zip.sh`: emit `MANIFEST`, drop `arcanum.version` from the zip

- After computing the `FILES` array (already sorted by `git ls-files`), write it one-path-per-line to `"${OUTPUT_DIR}/MANIFEST"`.
- After the existing `zip -q "$ZIP_PATH" "${FILES[@]}"` call, add a second call: `zip -j -q "$ZIP_PATH" "${OUTPUT_DIR}/MANIFEST"` — `-j` (junk paths) stores it at the zip root as `MANIFEST`, regardless of `OUTPUT_DIR`'s actual location, so it lands at `RELEASE_ROOT/MANIFEST` after unzip, alongside `arcanum/`.
- Add `"arcanum.version"` to the `EXCLUDES` array — installs no longer read a shipped `arcanum.version` file (see Step 3); the file still lives at the repo root for `bump-version.sh`/release tagging, it just no longer needs to be copied into installed targets.
- Clean up the temporary `${OUTPUT_DIR}/MANIFEST` file after zipping (it's a build artifact, not meant to linger in `dist/`).

### Step 2 — `arcanum/install/bootstrap.sh`: export resolved `REPO`/`VERSION`

`installer.sh` needs `REPO`/`VERSION` to write `arcanum.json` (Step 3), but `bootstrap.sh` hands off via `exec`, which only carries *exported* environment variables into the replacced process image — today `REPO`/`VERSION` are plain local shell variables. Add `export REPO` and `export VERSION` right after they're resolved (before the `exec` call). No other behavior change to this file.

### Step 3 — `arcanum/install/installer.sh`: write `arcanum.json`, redirect refusal to `update`

- Replace the existing-install check:
  ```bash
  if [[ -f "${TARGET}/arcanum.json" ]]; then
    echo "Error: an arcanum install already exists at ${TARGET}." >&2
    echo "Run the update script instead: bash ${TARGET}/arcanum/update/bootstrap.sh" >&2
    exit 1
  fi
  ```
  (was: checked `arcanum.version`, printed "This script does not support updates yet — remove the existing install manually first.")
- After the existing `cp -R "${RELEASE_ROOT}/." "$TARGET/"`, read `${RELEASE_ROOT}/MANIFEST` (one path per line) and write `${TARGET}/arcanum.json` via `jq -n`:
  ```bash
  jq -n --arg version "$VERSION" --arg repo "$REPO" --slurpfile manifest <(jq -R . "${RELEASE_ROOT}/MANIFEST" | jq -s .) \
    '{version: $version, repo: $repo, manifest: $manifest[0]}' > "${TARGET}/arcanum.json"
  ```
  (exact `jq` invocation is illustrative — implementer should verify against `RELEASE_ROOT/MANIFEST`'s actual line format; each line is a plain relative path, no escaping needed beyond `jq -R`).
- `REPO`/`VERSION` come from the environment (exported by `bootstrap.sh` in Step 2) — no new CLI args needed.

### Step 4 — `arcanum/update/bootstrap.sh` (new file)

Modeled on `arcanum/install/bootstrap.sh`, with three differences:

1. **Version resolution.** If `ARCANUM_VERSION` is unset, resolve it by querying `https://api.github.com/repos/${REPO}/releases/latest` and extracting `tag_name` with `grep`/`sed` (no `jq` — this stage stays dependency-free, matching the rest of `bootstrap.sh`). If the query fails, exit with a clear error (same style as the existing "failed to download" error).
2. **Target/repo pre-resolution, before downloading:**
   - `if [[ -f "${BASH_SOURCE[0]}" ]]`: running as a real file (not piped) — infer `TARGET` as two directories up from the script's own location (`SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`; `TARGET="$(cd "${SCRIPT_DIR}/../.." && pwd)"`), but only if `${TARGET}/arcanum.json` actually exists there — otherwise treat as unresolved (falls through to the interactive-prompt path in `updater.sh`, same as the piped case).
   - Else if `ARCANUM_TARGET` is set, use it directly as `TARGET`, no existence check needed (explicit user intent).
   - If `TARGET` was resolved by either branch above, and `ARCANUM_REPO` was **not** explicitly set, read `TARGET/arcanum.json`'s `repo` field (via `jq -r .repo`) and use it as the default for `REPO` instead of the hardcoded `darthjee/arcanum`. An explicit `ARCANUM_REPO` env var always wins over the detected value.
   - If `TARGET` could not be resolved (piped, no `ARCANUM_TARGET`), leave it unset — `updater.sh` will prompt.
3. **Handoff:** `export REPO`, `export VERSION`, and `export TARGET` (empty string if unresolved) before `exec "${WORK_DIR}/arcanum/update/updater.sh"`.

Everything else (download the release zip, `unzip -q ... -d "$WORK_DIR"`, `exec`) mirrors `install/bootstrap.sh` exactly.

### Step 5 — `arcanum/update/updater.sh` (new file)

1. **Resolve `TARGET`** if not already set via the environment: prompt interactively, identical UX to `installer.sh`'s current prompt (`expand_path`, default `~/.claude/skills`, confirm-if-different dance), reading from `/dev/tty`.
2. **Read old state:** `OLD_VERSION`, `OLD_REPO`, `OLD_MANIFEST` (array) from `${TARGET}/arcanum.json` via `jq`.
3. **Short-circuit if already up to date:** if `VERSION == OLD_VERSION`, print `"Already on ${VERSION}."` and exit 0 — skip the rest.
4. **Add/update:** `cp -R "${RELEASE_ROOT}/." "${TARGET}/"` (same one-shot copy `installer.sh` uses; self-limiting to whatever the verified zip actually unzipped, so no manifest-string-driven path risk here).
5. **Compute the delete set:** read `${RELEASE_ROOT}/MANIFEST` into `NEW_MANIFEST`; `comm -23 <(printf '%s\n' "${OLD_MANIFEST[@]}" | sort) <(sort "${RELEASE_ROOT}/MANIFEST")` gives paths in the old manifest absent from the new one.
6. **Validate before deleting (security-critical — see issue's Performance & security section):** for each candidate path, reject it outright (skip deletion, log a warning) if it's absolute or contains a `..` path segment; otherwise resolve `realpath -m "${TARGET}/${path}"` and confirm the result is still prefixed by `realpath "${TARGET}"` before calling `rm -f`.
7. **Write `arcanum.json` last**, only after steps 4–6 all succeed — mirrors Step 3's `jq -n` construction, using the *new* `VERSION`/`REPO`/`MANIFEST`. This ordering is what makes a partial failure safely retryable (old `arcanum.json` stays in place until the new state is fully applied).
8. **Clean up:** `trap 'rm -rf "$WORK_DIR"' EXIT` near the top of the script (this is the final stage — no further `exec`, unlike `bootstrap.sh`, so the trap actually fires).

### Step 6 — Update docs

- `docs/agents/architecture.md`'s "Install & Release Pipeline" section (in Portuguese, matching the rest of the file): describe the `update` two-stage flow alongside `install`'s, the `arcanum.json` format (replacing `arcanum.version`), the `MANIFEST` file, and `installer.sh`'s new redirect-to-`update` behavior instead of "recusa sobrescrever, sem fluxo de update ainda".
- `docs/agents/folder-structure.md`: update the `arcanum.version` row to describe `arcanum.json` instead (written dynamically, not present in the zip as a static file), and mention `arcanum/update/` alongside the existing `arcanum/install/` description.
- `README.md`: add an "Updating" section mirroring the existing "Installation" section — the `curl | bash` one-liner and the "run the local copy directly" form, matching the two invocation shapes documented in the issue.

## Files to Change

- `scripts/build_release_zip.sh` — emit `MANIFEST` into the zip; exclude `arcanum.version` from the zip contents
- `arcanum/install/bootstrap.sh` — `export REPO`/`VERSION` before `exec`
- `arcanum/install/installer.sh` — write `arcanum.json`; refusal check + message now targets `update`
- `arcanum/update/bootstrap.sh` — new file
- `arcanum/update/updater.sh` — new file
- `docs/agents/architecture.md` — document the update flow and `arcanum.json`
- `docs/agents/folder-structure.md` — update the `arcanum.version`/`arcanum.json` row, mention `arcanum/update/`
- `README.md` — add an "Updating" section

## CI Checks

None apply — `.circleci/config.yml` only runs `build-and-release` on semver tag pushes (packages and publishes the release zip via `scripts/build_release_zip.sh`); there is no lint/test job in this repo today (see `docs/agents/todo.md`'s note on the missing shell-script test framework). Manual verification (Notes below) is the only check available pre-merge.

## Notes

- **Path-traversal safety (Step 5.6) is the one genuinely security-sensitive piece of this plan** — do not skip the absolute-path/`..`-segment rejection and the `realpath`-prefix check before any `rm -f` in the delete pass. Covered in detail in the issue's "Performance & security considerations" section.
- No formal test framework exists in this repo yet (`docs/agents/todo.md`). Recommended manual verification before merging, following the precedent set by the regression script added for #111: in a scratch directory, run `scripts/build_release_zip.sh` to build a zip, install it via `installer.sh` into a temp target, bump `arcanum.version`, rebuild the zip, then run `arcanum/update/updater.sh` (or the full `bootstrap.sh` flow with `ARCANUM_TARGET` pointed at the temp dir) against it — confirm added/changed/removed files land correctly and `arcanum.json` ends up accurate. This is exploratory verification, not a committed test suite; formalizing that is the separate, already-noted `docs/agents/todo.md` follow-up.
- The exact `jq` manifest-construction one-liners in Steps 3 and 5 are illustrative of the data shape, not prescriptive syntax — verify against real `MANIFEST`/`arcanum.json` content while implementing.
- `installer.sh`'s interactive-prompt code (`expand_path`, the `/dev/tty` read, the confirm-if-different dance) is duplicated rather than extracted into a shared `_lib` function for this plan, to keep the change scoped — `updater.sh` needs the identical UX per the issue's design, so consider a follow-up extraction into `arcanum/_lib/` if the duplication becomes annoying to maintain, but it is not required for this issue.
