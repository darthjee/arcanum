# Issue: Add arcanum-split-issue skill

## Description
A new skill, `arcanum-split-issue`, that breaks a single GitHub issue into several sub-issues. Given an issue id, it drives a discussion with the user about how to split the work, generates one local draft file per sub-issue, pushes each as a real GitHub issue linked to the parent via GitHub's native sub-issue relationship, and cleans up afterward. The resulting sub-issues are meant to flow individually through the existing `enhance-issue` → `discuss-issue` → `plan-issue`/`auto-plan-issue` → `auto-fix-issue` pipeline.

## Problem
Large or broad issues don't fit well into the existing per-issue pipeline (`enhance-issue`/`discuss-issue`/`plan-issue`/`auto-fix-issue`), which is built around implementing one cohesive issue at a time. There's currently no skill to deliberately break such an issue into smaller, independently workable sub-issues on GitHub, so splitting has to be done manually.

## Expected Behavior
- User invokes `/arcanum-split-issue #<id>`.
- The skill downloads the issue and, if it already has tracked sub-issues (`.claude/state/issue-<id>.json["sub-issues"]` is non-empty), asks the user whether to skip (already split) or continue appending more sub-issues.
- A light exploration pass looks for similar existing features, responsible agents, and affected code areas (not deep edge-case/security analysis — that surfaces during discussion instead).
- The AI and user discuss the overall tasks and how to split them, guided by `docs/agents/arcanum-split-issue.md` (degrading gracefully if that file doesn't exist yet), until the user is satisfied. The AI may decide the split itself if the user has no preference.
- Once satisfied, the AI first pushes the updated parent issue body (with the discussion/decisions) to the live GitHub issue, so nothing is lost if a later step fails.
- Then one local draft file per sub-issue is generated under `docs/agents/issues/`.
- The AI shows a summary (sub-issue count and titles) and asks for explicit yes/no confirmation before anything is pushed to GitHub.
- On confirmation, each sub-issue is created on GitHub, linked to the parent as a native GitHub sub-issue, and tracked in `.claude/state/issue-<id>.json`.
- If one sub-issue's push exhausts its retry budget, the run stops there (no further sub-issues, no finishing step); already-created sub-issues are left as-is, and the user is told what succeeded, what failed, and to double check GitHub before deciding how to proceed.
- Once all sub-issues are pushed successfully, the parent issue is relabeled (`Planning` → `Split`, stays open as a tracking issue) and the local draft/sub-issue files are deleted.

## Solution

### Naming
Named `arcanum-split-issue`, not `arcanum-plan-issues`:
- `plan-issue` already exists as a distinct skill (creates an implementation plan for a single issue) — `arcanum-plan-issues` was too close a name and would have been confusing.
- The `arcanum-` prefix is otherwise reserved in this repo for self-maintenance tools (`arcanum-migrate`, `arcanum-update` — updating/migrating the arcanum install itself), not workflow skills like this one. Every other pipeline skill (`discuss-issue`, `enhance-issue`, `plan-issue`) uses a plain verb-noun name with no prefix.
- Using the `arcanum-` prefix for this skill anyway, but only as a one-off for now — whether `arcanum-` becomes the general default prefix for future skills is a separate, repo-wide naming-policy decision left open.

### Invocation, ID and issue download
- Reuses the same id-resolution/fetch process as `discuss-issue`.
- `resolve_and_fetch.sh` is promoted from `discuss-issue/scripts/` to `arcanum/_lib/resolve_and_fetch.sh` (matching the existing pattern already used by `resolve_id_and_file.sh` and `github_issue.sh`/fetch, both already canonical in `_lib`). `discuss-issue/scripts/resolve_and_fetch.sh` becomes a thin wrapper (`exec ../../arcanum/_lib/resolve_and_fetch.sh "$@"`) like its siblings; `enhance-issue` keeps calling the `discuss-issue` wrapper unchanged; `arcanum-split-issue` calls `arcanum/_lib/resolve_and_fetch.sh` directly, avoiding a second skill reaching two levels into `discuss-issue/scripts/`.
- Before starting the discussion, the initial invocation script checks whether the parent issue already has entries in `.claude/state/issue-<issue_id>.json["sub-issues"]`. If it does, the AI asks the user whether they want to skip (issue was already split) or continue and append more sub-issues (discussion resumes and new files continue the existing `zero_indexed_count` sequence).

### Exploration
A very light exploration pass (lighter than `discuss-issue` or `enhance-issue`), looking into docs and code as needed, to understand the feature being split rather than its implementation:
- Other similar features already in the codebase.
- Which agents are responsible for which parts.
- What parts of the code could be involved (routes, infra, etc.).

Not specifically looking for edge cases or in-depth security concerns at this stage — but if found, they're brought up during discussion instead of being investigated deeply here.

### Discussion
The same way `enhance-issue` reads `docs/agents/issue-enhancement.md` for its checklist, `arcanum-split-issue` reads `docs/agents/arcanum-split-issue.md` (with the same graceful-fallback behavior `enhance-issue` uses when its checklist file is missing).

Discussion continues until the user is satisfied. A key question is how the user wants the sub-issues split — if they have no preference, the AI decides on their behalf. Decisions are stored in the issue file the same way `enhance-issue` does.

Once the user is satisfied with the split, the AI first pushes the updated parent issue draft (the discussion content accumulated so far, including how the split was decided) to the live GitHub issue via `github.sh update` — the same way `discuss-issue` and `enhance-issue` push their draft before finishing — so the discussion is preserved on GitHub even if something fails during sub-issue file generation or creation afterward.

Only then are the sub-issue files generated. Before running the push-to-GitHub script for the sub-issues, the AI shows a summary (sub-issue count and titles) and asks for an explicit yes/no confirmation (reusing `discuss-issue/scripts/confirm.sh`'s normalizer). Creating real, visible GitHub issues is treated as an external action worth confirming, distinct from the "are you satisfied with the split" signal that ends the discussion loop. Only on confirmation are the sub-issues pushed to GitHub.

### Issue splitting (local file generation)
For each sub-issue, a new file is created at `docs/agents/issues/<issue_id>_<zero_indexed_count>_<subissue_snake_case_title>.md`, via a script that takes `$REPO_PATH`, the issue id, and the body:
- `$REPO_PATH` is required so the script never writes into the skills folder itself.
- It scans existing `docs/agents/issues/<issue_id>_<zero_indexed_count>_*` files to determine the next count (starts at 1 if none exist, otherwise increments the highest found).
- The snake_case title is generated from the sub-issue title.
- `zero_indexed_count` is zero-padded: 01, 02, ..., 09, 10, 11, ...
- The file's first line is `# <regular case sub_issue_title>`, followed by the body.

### Pushing sub-issues to GitHub
Split into two scripts, not one:
- A **single-file script** taking `$REPO_PATH`, `issue_id`, and one sub-issue file: extracts the title (first line) and body (remaining lines) from the file, creates the GitHub issue with the parent's labels except swapping `Planning` out for `Writting` (so the new sub-issue enters the standard `Idea`/`Writting` pipeline stage, ready for `enhance-issue`), links it to the parent as a native GitHub sub-issue (see below), and updates `.claude/state/issue-<issue_id>.json["sub-issues"]` (created as `[<id>]` if absent, otherwise appended).
- A **batch driver script** that iterates over all `docs/agents/issues/<issue_id>_<zero_indexed_count>_*` files and calls the single-file script for each.

This split matters for partial-failure recovery (below): once retries are exhausted for one file, the AI can call the single-file script directly for just that file later, without re-running the whole batch or risking duplicate creation for files that already succeeded.

Per-file retry loop:
- Logs when a sub-issue is being created (issue id, sub-issue count, title).
- On error, waits and retries, up to a maximum. Both values are configurable in `.claude/state/arcanum-config.json` under `"plan-issues"`: `"error-sleep-time"` (default 5 seconds) and `"max-retry-count"` (default 5), used when the keys/file are absent.

**Partial failure** (one sub-issue exhausts its retry budget):
- The batch driver stops — no further files are processed, and the "Finishing up" step does not run (parent issue stays labeled `Planning`, not `Split`).
- It reports clearly which sub-issue files succeeded (with their new issue numbers) and which one failed.
- It tells the user to check GitHub directly to rule out a false-negative (e.g. the issue was actually created but the confirmation step errored) before deciding.
- No automatic rollback of already-created sub-issues.
- The user then tells the AI what to do next (retry, skip, etc.); the AI acts on that by calling the single-file script directly, not by re-running the batch driver.

### Sub-issue linking (GitHub side)
Sub-issues are linked to the parent using GitHub's *native* sub-issue relationship (currently accessed via `gh api graphql`, not a REST endpoint), not just a text reference in the body — this makes the parent issue show a nested progress checklist in GitHub's UI. This repo already calls `gh api graphql` elsewhere (`auto-monitor-pr/scripts/monitor_pr.sh`), so there's precedent.

Per sub-issue, after `gh issue create` returns the new issue number:
- Fetch the GraphQL node id of the parent issue and the new sub-issue.
- Call the `addSubIssue` mutation with `issueId` = parent's node id and `subIssueId` = sub-issue's node id.
- This is in addition to, not instead of, the `.claude/state/issue-<issue_id>.json` "sub-issues" array tracking.

### Finishing up
After all sub-issues have been pushed successfully, a single finishing script (`$REPO_PATH`, parent `issue_id`) that:
- Relabels the parent issue: add `Split`, remove `Planning` (implemented as `github.sh mark-split`, mirroring `mark-created`/`mark-enhancing` in `arcanum/_lib/github_issue.sh`).
- Deletes the local working files from `docs/agents/issues/`: the parent's own draft file and every generated sub-issue file — none of this is committed, matching how `enhance-issue` deletes its local draft after publishing.

### Labels
Two-stage lifecycle on the parent issue, mirroring the existing `mark-enhancing`/`mark-created` pattern. `arcanum-split-issue` can be invoked either before `enhance-issue` (on a bare `Idea`/`Writting` issue) or after it (on a `Created` issue) — not after `discuss-issue`/`plan-issue` (`Refined`/`Ready`), so:
- On invocation: add `Planning`, remove `Idea`/`Writting`/`Created` if present.
- Once the split is done and all sub-issues are pushed: add `Split` (color `000000`), remove `Planning` — done by the finishing script.
- The parent issue is **not** closed after the split — it stays open, now labeled `Split`, as a tracking/umbrella issue. It is not picked up by `auto-fix-all` on its own.
- `Planning` (color `c5def5`) was chosen over `Plan` or anything tied to the existing `plan-issue`/`auto-plan-issue` skills, to avoid the same naming confusion the skill rename addressed.

### init-claude changes
- `init-claude` is updated to also generate `docs/agents/arcanum-split-issue.md`, the same way it generates `docs/agents/issue-enhancement.md`.
- Two new labels are added to the default label set: `Planning` (`c5def5`) and `Split` (`000000`).

### Migration
A migration adds, in `.claude/state/arcanum-config.json` under the key `"plan-issues"`:
- `"max-retry-count"` (default 5 when no tty)
- `"error-sleep-time"` (default 5 seconds when no tty)

The migration stays deterministic — same as every existing migration under `arcanum/migrations/repos/` (config keys, `label_config_add` entries) — and does **not** interactively re-trigger `init-claude`'s doc-generation dialogue for repos missing `docs/agents/arcanum-split-issue.md`. That's unnecessary: the Discussion behavior above already degrades gracefully when that file is missing, the same way `enhance-issue` does for `issue-enhancement.md` — no migration-time interactivity needed, which would otherwise be a new pattern no existing migration has.

### Testing strategy
This repo has no CI test runner or test framework — only two standalone regression-check scripts (`arcanum/_lib/test_origin_resolution.sh`, `scripts/test_generate_tags_table.sh`) that assert pure logic in a temp dir, run manually. Following that convention: add one standalone script covering the sub-issue file naming/counting logic (scanning `docs/agents/issues/<issue_id>_<zero_indexed_count>_*` to determine the next count) — pure logic, no live `gh` calls needed, and the exact kind of off-by-one/collision risk those existing scripts guard against. Everything else (label transitions, GitHub sub-issue linking, the retry loop) is verified by manual end-to-end runs against a real throwaway issue, same as other skills in this repo.

## Benefits
- Large or broad issues can be broken into independently workable sub-issues that fit the existing per-issue pipeline (`enhance-issue`/`discuss-issue`/`plan-issue`/`auto-fix-issue`).
- Reuses existing conventions instead of inventing new ones: thin `_lib` wrappers, the `mark-*` label-lifecycle pattern, `gh api graphql` for GitHub relationships, and standalone regression scripts for pure logic.
- Partial failures are recoverable without risk of duplicate sub-issues, thanks to the single-file/batch-driver script split.
- Native GitHub sub-issue linking gives visible parent/child progress tracking in GitHub's own UI, not just an internal state file.
