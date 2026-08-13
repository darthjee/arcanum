# Plan: Add arcanum-split-issue skill

Issue: [141-add-arcanum-split-issue-skill.md](../../issues/141-add-arcanum-split-issue-skill.md)

## Overview

Add a new skill, `arcanum-split-issue`, that discusses how to break a GitHub issue into sub-issues, generates one local draft file per sub-issue, pushes the parent's discussion to GitHub first, then pushes each sub-issue as a real GitHub issue natively linked to the parent, and finally relabels the parent and cleans up local files. This requires: a new skill folder, two new `mark-*` label transitions in `arcanum/_lib/github_issue.sh`, promoting `resolve_and_fetch.sh` to `arcanum/_lib/`, `init-claude` changes (new checklist doc, new default labels), and a deterministic migration for two new config keys.

## Context

See the issue file for the full discussion. Key decisions already made and non-negotiable for this plan:
- Skill name is `arcanum-split-issue` (not `arcanum-plan-issues`), to avoid confusion with the existing `plan-issue`/`auto-plan-issue` skills.
- Sub-issues are linked to the parent via GitHub's native sub-issue relationship (`gh api graphql`'s `addSubIssue` mutation) — precedent for raw `gh api graphql` calls already exists in `auto-monitor-pr/scripts/monitor_pr.sh`.
- The push-to-GitHub step for sub-issues is split into a **batch driver script** and a **single-file script**, so a partial failure can be retried file-by-file without re-running the whole batch.
- Parent label lifecycle: `Planning` (`c5def5`) on invocation → `Split` (`000000`) once all sub-issues are pushed. Invocable from either `Idea`/`Writting` or `Created` (not `Refined`/`Ready`), so invocation removes whichever of `Idea`/`Writting`/`Created` is present.
- Migration only adds the two config keys (`plan-issues.max-retry-count`, `plan-issues.error-sleep-time`) — it does **not** sync the new labels to already-initialized repos (see Notes).

## Implementation Steps

### Step 1 — Add `Planning`/`Split` to the default label set

In `init-claude/scripts/lib/label_config.sh`, add two entries to `DEFAULT_LABEL_PAIRS`:
```
Planning:c5def5
Split:000000
```
This only affects fresh `label_config_ensure_defaults` seeding (new installs, or repos with an empty/missing label config) — existing repos need a manual `/init-claude` label-sync re-run to pick these up (see Notes).

### Step 2 — Add `mark-planning`/`mark-split` to `arcanum/_lib/github_issue.sh`

Following the exact shape of `cmd_mark_enhancing`/`cmd_mark_created` (lines ~210–241 today), add:

- `cmd_mark_planning <repo_path> <id>`: add `planning`; remove `idea`, `writting`, `created` (all three, since this skill can be invoked from either stage — unlike `mark-enhancing`, which only removes `idea`/`writting`).
- `cmd_mark_split <repo_path> <id>`: add `split`; remove `planning`.

Wire both into the `case` dispatch near the bottom of the file (alongside `mark-created`/`mark-enhancing`/`mark-ready`), and into the usage/help text block that lists each subcommand.

After this change, run `scripts/generate_tags_table.sh` (repo dev tooling, not a skill script) to refresh the auto-generated `docs/agents/tag-mutations.md` with the new call sites once Step 4's `arcanum-split-issue/scripts/github.sh` wrapper calls them.

### Step 3 — Promote `resolve_and_fetch.sh` to `arcanum/_lib/`

- Move `discuss-issue/scripts/resolve_and_fetch.sh` to `arcanum/_lib/resolve_and_fetch.sh`, updating its internal relative references (`SCRIPT_DIR/resolve_id_and_file.sh` → sibling in `_lib`, already there; `SCRIPT_DIR/github.sh` → `SCRIPT_DIR/github_issue.sh`, already there) since it now lives alongside both.
- Replace `discuss-issue/scripts/resolve_and_fetch.sh` with a thin wrapper, matching the existing pattern of `discuss-issue/scripts/resolve_id_and_file.sh` and `discuss-issue/scripts/github.sh`:
  ```bash
  #!/usr/bin/env bash
  # Thin wrapper — delegates to the canonical copy in arcanum/_lib/
  set -euo pipefail
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec "${SCRIPT_DIR}/../../arcanum/_lib/resolve_and_fetch.sh" "$@"
  ```
- No caller changes needed: `discuss-issue/steps/extract_id_and_name.md` and `enhance-issue/steps/fetch.md` both call the wrapper by relative path today and keep working unchanged.

### Step 4 — Create the `arcanum-split-issue` skill

New top-level folder `arcanum-split-issue/`, modeled directly on `enhance-issue/` (closest existing analog: fetch → light exploration → topic dialogue loop → publish) with an extra split/push/finish phase. Structure:

- `arcanum-split-issue/SKILL.md` — frontmatter (`name: arcanum-split-issue`, description per the issue's Objective), resolves `REPO_PATH="$(pwd)"`, and sequences the steps below (mirroring `enhance-issue/SKILL.md`'s shape).
- `arcanum-split-issue/steps/fetch.md` — resolve id + fetch content, same contract as `enhance-issue/steps/fetch.md`:
  1. Call `arcanum/_lib/resolve_and_fetch.sh` directly (not through a `discuss-issue`-relative path — this skill lives at the same nesting depth as `discuss-issue`/`enhance-issue`, so resolve `../../arcanum/_lib/resolve_and_fetch.sh` relative to `steps/`).
  2. Run `arcanum-split-issue/scripts/github.sh mark-planning "$REPO_PATH" <id>` (best-effort, mirrors `enhance-issue`'s `mark-enhancing` call).
  3. Check `.claude/state/issue-<id>.json["sub-issues"]` (via `arcanum/_lib/issue_state.sh`, already used elsewhere for this file) — if non-empty, ask the user whether to skip or continue appending more sub-issues before proceeding.
- `arcanum-split-issue/steps/explore.md` — same shape as `enhance-issue/steps/explore.md`, but scoped per the issue's Exploration section (similar features, responsible agents, affected code areas; not edge cases/security).
- `arcanum-split-issue/steps/discuss.md` — topic-driven dialogue loop, closely mirroring `enhance-issue/steps/dialogue.md`:
  1. Read `docs/agents/arcanum-split-issue.md` if present (degrade gracefully — proceed without a checklist — if missing, exactly like `enhance-issue` does for `issue-enhancement.md`).
  2. Loop discussing until the user is satisfied, one of the topics being how to split the sub-issues (AI decides if the user has no preference).
  3. Once satisfied: push the updated parent issue body to GitHub via `github.sh update` (reusing the same script contract `discuss-issue`/`enhance-issue` use) — this must happen *before* generating sub-issue files, so the discussion isn't lost if a later step fails.
- `arcanum-split-issue/steps/split.md` — generate one local file per sub-issue via `scripts/create_sub_issue_file.sh` (Step 5), then show a summary (count + titles) and ask for an explicit y/n via `scripts/confirm.sh` (reuse `discuss-issue/scripts/confirm.sh` directly by relative path — no need to duplicate it) before proceeding.
- `arcanum-split-issue/steps/push.md` — on confirmation, run `scripts/push_sub_issues.sh` (batch driver, Step 5). On success, run `scripts/finish.sh` (Step 5). On partial failure, report per the issue's "Partial failure" section and stop — do not run `finish.sh`.

### Step 5 — `arcanum-split-issue/scripts/`

- `github.sh` — thin wrapper delegating to `arcanum/_lib/github_issue.sh`, same one-liner pattern as every other skill's `github.sh`.
- `create_sub_issue_file.sh <repo_path> <issue_id> <title> <body_file>` — scans `docs/agents/issues/<issue_id>_<zero_indexed_count>_*` to find the next zero-padded count (start at `01`; per the issue, counts are zero-padded starting from 1, not 0-indexed despite the "zero_indexed_count" naming inherited from the issue text), snake-cases the title, writes `# <Title>\n\n<body>` to `docs/agents/issues/<issue_id>_<count>_<snake_title>.md`. This is the piece covered by Step 6's regression test.
- `create_sub_issue.sh <repo_path> <issue_id> <sub_issue_file>` — the single-file script:
  1. Extract title (first line, strip leading `# `) and body (remaining lines) from `<sub_issue_file>`.
  2. Retry loop around `gh issue create`, reading `plan-issues.max-retry-count`/`plan-issues.error-sleep-time` from `.claude/state/arcanum-config.json` via `arcanum/_lib/repo_config.sh`'s `repo_config_read` (default 5 / 5s if absent), logging issue id / sub-issue count / title before each attempt.
  3. Labels: copy the parent issue's current labels, swap `planning` for `writting` (so the sub-issue enters the `Idea`/`Writting` stage, ready for `enhance-issue`).
  4. On success: resolve the parent's and new sub-issue's GraphQL node ids (`gh issue view <n> --json id -q .id`) and call the `addSubIssue` mutation via `gh api graphql` (same invocation style as `auto-monitor-pr/scripts/monitor_pr.sh`'s `addReaction`/`removeReaction` calls).
  5. Update `.claude/state/issue-<issue_id>.json["sub-issues"]` (append, or initialize as `[<id>]`) via `arcanum/_lib/issue_state.sh` if it already exposes an array-append helper, otherwise a small `jq` update following that file's existing read/write pattern.
  6. Print the new issue number on success (stdout contract for the batch driver to collect).
- `push_sub_issues.sh <repo_path> <issue_id>` — the batch driver: iterates `docs/agents/issues/<issue_id>_*` files in ascending count order, calling `create_sub_issue.sh` for each; stops immediately and reports success/failure per file if one exhausts its retries (does not call `finish.sh`).
- `finish.sh <repo_path> <issue_id>` — runs `github.sh mark-split`, then deletes the parent's own draft file and every `docs/agents/issues/<issue_id>_*` sub-issue file.

### Step 6 — Regression test for the file-naming/counting logic

Add `arcanum-split-issue/scripts/test_create_sub_issue_file.sh`, following the exact shape of `arcanum/_lib/test_origin_resolution.sh` (standalone, temp dir, `fail()` helper, run manually — not wired into any skill flow or CI). Assert: first sub-issue for a fresh id gets count `01`; a second call increments to `02`; an existing `..._03_...` file makes the next call produce `04` (gap-tolerant, mirrors `generate_next.sh`'s "never fills a gap" behavior); the snake_case title matches expectations.

### Step 7 — `init-claude` changes

- `init-claude/scripts/setup_docs_structure.sh`: add a `_create_file "docs/agents/arcanum-split-issue.md" "..."` block, placeholder content mirroring the existing `issue-enhancement.md` block's shape (title, one-line intro, starter checklist — content TBD by whoever writes it, structurally identical).
- New `init-claude/setup_arcanum_split_issue.md`, mirroring `init-claude/setup_issue_enhancement.md` exactly (same 5-step shape: load current content → present + ask for changes → iterate → write file → confirm), targeting `docs/agents/arcanum-split-issue.md` instead.
- `init-claude/SKILL.md`: insert a new step "Setup arcanum-split-issue concerns" (reading `setup_arcanum_split_issue.md`) immediately after the existing "Step 12 — Setup issue enhancement concerns", renumbering the current "Step 13 — Stamp the arcanum version" to Step 14 (it must stay last).

### Step 8 — Migration

- `arcanum/migrations/generate_next.sh` will report `002` as the next number (since `arcanum/migrations/repos/next/001.sh` already exists). Add `arcanum/migrations/repos/next/002.sh` and `002.md`, following `001.sh`'s shape (`config`/`run` subcommands, sourcing `arcanum/_lib/repo_config.sh`):
  ```bash
  cmd_config() { echo '{"skippable": true}'; }
  cmd_run() {
    repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "max-retry-count" 5
    repo_config_write ".claude/state/arcanum-config.json" "" "plan-issues" "error-sleep-time" 5
  }
  ```
  (empty string for `<legacy_file>` — there is no legacy/pre-namespaced file for these brand-new keys, and `repo_config_write`'s seed step is a no-op when the legacy file doesn't exist.)
- `002.md`: short human-readable summary, same purpose as `001.md`'s (a `001.md` file doesn't currently exist on disk despite being referenced by convention — write `002.md` regardless, since it's clearly the intended pattern; flag the missing `001.md` to the architect/user as a pre-existing gap, out of scope to fix here).

## Files to Change

- `init-claude/scripts/lib/label_config.sh` — add `Planning`/`Split` to `DEFAULT_LABEL_PAIRS`.
- `arcanum/_lib/github_issue.sh` — add `cmd_mark_planning`, `cmd_mark_split`, dispatch, help text.
- `arcanum/_lib/resolve_and_fetch.sh` — new (moved from `discuss-issue/scripts/`).
- `discuss-issue/scripts/resolve_and_fetch.sh` — replaced with thin wrapper.
- `arcanum-split-issue/SKILL.md` — new.
- `arcanum-split-issue/steps/fetch.md`, `explore.md`, `discuss.md`, `split.md`, `push.md` — new.
- `arcanum-split-issue/scripts/github.sh`, `create_sub_issue_file.sh`, `create_sub_issue.sh`, `push_sub_issues.sh`, `finish.sh`, `test_create_sub_issue_file.sh` — new.
- `init-claude/scripts/setup_docs_structure.sh` — add `arcanum-split-issue.md` placeholder creation.
- `init-claude/setup_arcanum_split_issue.md` — new.
- `init-claude/SKILL.md` — insert new step, renumber "Stamp the arcanum version".
- `arcanum/migrations/repos/next/002.sh`, `002.md` — new.
- `docs/agents/tag-mutations.md` — regenerate via `scripts/generate_tags_table.sh` after Step 2/4 land (auto-generated, do not hand-edit).

## CI Checks

None found — this repo has no `.github/workflows/` CI configuration and no automated test runner; verification is manual (see Step 6 and the issue's Testing strategy section).

## Notes

- **Existing repos won't get the new labels automatically.** `label_config_ensure_defaults` (Step 1) only seeds `DEFAULT_LABEL_PAIRS` into an empty/missing config — a repo that already ran `/init-claude` keeps its existing label set untouched until someone re-runs the label-sync step manually. The migration (Step 8) deliberately does not touch labels, per the issue's resolved "Migration scope" discussion. This is expected, not a gap to fix here.
- **`001.md` is missing on disk** even though `001.sh` exists and clearly expects a paired `.md` per the migration folder's own convention (see `docs/agents/architecture.md`'s migrations layout description). Step 8 adds `002.md` regardless, matching the intended pattern; fixing `001.md`'s absence is out of scope for this issue.
- The exact wording/checklist content of `docs/agents/arcanum-split-issue.md`'s placeholder (Step 7) is a judgment call for whoever implements this — keep it structurally parallel to `issue-enhancement.md`'s placeholder, but scoped to splitting concerns (e.g. "does each sub-issue stand alone?", "is the split granularity right?").
- `arcanum/_lib/issue_state.sh` already exists and is presumably where `.claude/state/issue-<id>.json` reads/writes are centralized — Step 5's `create_sub_issue.sh` and Step 4's sub-issue-existence check should use whatever helpers it already exposes rather than hand-rolling `jq` calls; if it doesn't yet expose an array-append helper, add one there rather than duplicating the logic inline.
