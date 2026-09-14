# Scripter Plan: Fix SC2034 MIGRATIONS_SCRIPT_DIR cluster: verify unused vs. sourced across migrations scripts

Main plan: [plan.md](plan.md)

## Overview

Codacy's ShellCheck flags `MIGRATIONS_SCRIPT_DIR` as an unused assignment (SC2034) in 3 `arcanum/migrations` scripts. Repo-wide investigation (`grep -rn "MIGRATIONS_SCRIPT_DIR"`) confirms all 3 are genuinely consumed, not dead: each sets `MIGRATIONS_SCRIPT_DIR` immediately before sourcing `_pending_versions.sh`, which reads it via `source "${MIGRATIONS_SCRIPT_DIR}/_manifest.sh"` and the `for dir in "${MIGRATIONS_SCRIPT_DIR}"/repos/*/` loop. ShellCheck can't see this cross-file usage, hence the false positive.

## Context

- `arcanum/migrations/update_per_version.sh:94` sets `MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"`, then sources `_pending_versions.sh` at line 103.
- `arcanum/migrations/run.sh:91` sets `MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"`, then sources `_pending_versions.sh` at line 100.
- `arcanum/migrations/select_version.sh:38` sets `MIGRATIONS_SCRIPT_DIR="$SCRIPT_DIR"`, then sources `_pending_versions.sh` at line 45.
- None of the 3 should be removed — all are load-bearing for `_pending_versions.sh`. Follow the same "keep + suppress" precedent already used for the sibling `LOCK_FILE` (#472) and `REPO_PATH` (#473) clusters from the same parent issue (#464).

## Implementation Steps

### Step 1 — Add SC2034 suppression comments

For each of the 3 locations, add a `# shellcheck disable=SC2034` comment immediately above the assignment line, naming `_pending_versions.sh` as the consumer (match the wording style of #472/#473's suppressions — name the actual consumer file, not a vague "used elsewhere"):

- `arcanum/migrations/update_per_version.sh:94`
- `arcanum/migrations/run.sh:91`
- `arcanum/migrations/select_version.sh:38`

### Step 2 — Verify no behavior change and findings clear

- Run ShellCheck locally on each of the 3 files (e.g. `shellcheck arcanum/migrations/update_per_version.sh`) and confirm no SC2034 finding remains for `MIGRATIONS_SCRIPT_DIR`.
- Run `bash -n` on each of the 3 files to confirm they still parse cleanly after the comment-only edit.
- Confirm the diff is comment-only — no assignment, sourcing order, or logic changes.

## Files to Change

- `arcanum/migrations/update_per_version.sh` — add suppression comment above the `MIGRATIONS_SCRIPT_DIR` assignment (line 94)
- `arcanum/migrations/run.sh` — add suppression comment above the `MIGRATIONS_SCRIPT_DIR` assignment (line 91)
- `arcanum/migrations/select_version.sh` — add suppression comment above the `MIGRATIONS_SCRIPT_DIR` assignment (line 38)

## CI Checks

No ShellCheck/lint job found in `.circleci/config.yml` — SC2034 findings surface via Codacy's external analysis, not local CI. Use the local `shellcheck`/`bash -n` spot checks in Step 2 instead.

## Notes

- Investigation ruling out removal for all 3 locations was already done during `discuss-issue`; this plan only needs to apply the suppression, not re-investigate.
- Sibling clusters from the same parent issue (#464): #472 (`LOCK_FILE`, merged), #473 (`REPO_PATH`, merged), #475 (standalone findings, still open).
