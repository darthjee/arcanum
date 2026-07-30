# Issue: Add new usefull labels

## Description
`init-claude` recently introduced two new GitHub labels, `Idea` and `Writting`, meant to mark issues that are still being drafted by the user (before they reach the `Created` stage). These labels already exist on the repo but nothing in the pipeline consumes or clears them yet, so once an issue reaches `discuss-issue`, they linger on the issue alongside `Refined`/`Ready` instead of being cleaned up. Separately, the `PR` label (also already present on the repo) is meant to mark that a pull request has been opened for an issue, but no script currently applies it.

## Problem
- `Idea` and `Writting` are not recognized as canonical tags in `_lib/tags.sh`, so `_lib/tag_mutate.sh` cannot add/remove them, and `discuss-issue`'s `mark-refined` (`_lib/github_issue.sh`'s `cmd_mark_refined`) only removes `created` today — `idea`/`writting` are left dangling on the issue after refinement.
- `PR` is likewise not a canonical tag, and `auto-fix-issue/scripts/github.sh`'s `pr-create`/`pr-ready` commands never touch issue labels or `.claude/state/issue-<id>.json` at all — so an opened/ready PR is not reflected on the issue's labels or state file, and the issue's `shipit` intent (tracked only in the issue's labels/state) never propagates to the PR itself.

## Expected Behavior
- When `discuss-issue` marks an issue `Refined`, the `Idea` and `Writting` labels (if present) are removed in the same step as `Created`, best-effort, matching the existing pattern for `created`.
- When `auto-fix-issue` creates a PR (`pr-create`) or marks one ready (`pr-ready`):
  - the issue gains the `PR` label (idempotent — no-op if already present).
  - `.claude/state/issue-<id>.json`'s `tags` field is refreshed from the issue's current GitHub labels.
  - if the issue's tags include `shipit`, the PR is labeled `auto-shipit` — a new, purely informational label (no automation reads or acts on it) that just tells a developer at a glance "this issue already had shipit approval" without touching the human-only `shipit` label itself.

## Solution
1. Add `idea` → `Idea`, `writting` → `Writting`, and `pr` → `PR` to the canonical-tag/label table in `_lib/tags.sh` (both lookup directions), and document them in `docs/agents/architecture.md`'s Issue Tags table, so `tag_mutate_add_label`/`tag_mutate_remove_label` can operate on them like any other tag.
2. Update `_lib/github_issue.sh`'s `cmd_mark_refined` to also call `tag_mutate_remove_label ... idea` and `tag_mutate_remove_label ... writting` alongside the existing `created` removal.
3. Add a new GitHub label `auto-shipit` (color `ffb004`) to `init-claude`'s `DEFAULT_LABEL_PAIRS` (`init-claude/scripts/lib/label_config.sh`), so it gets created/synced like `Idea`/`Writting`/`PR` already are. This label carries no automation/mechanic of its own — it's purely informational.
4. Update `auto-fix-issue/scripts/github.sh`'s `cmd_pr_create` and `cmd_pr_ready` to, after a successful PR create/ready call, using the issue id parsed from the current branch name (`issue-<id>`, same pattern `_persist_pr_state` already uses):
   - add the `PR` label to the issue,
   - fetch the issue's current labels and refresh `.claude/state/issue-<id>.json`'s `tags` field (same `extract_tags`-based approach `cmd_fetch` in `_lib/github_issue.sh` already uses),
   - if `shipit` is among those tags, add the `auto-shipit` label to the PR (via `gh pr edit --add-label auto-shipit`). This sidesteps `_lib/tag_mutate.sh`'s shipit guard entirely — that guard protects the human-only `shipit` label on issues, and is left untouched; `auto-shipit` is a distinct label applied to the PR object.

## Benefits
- Issue labels stay accurate end-to-end instead of accumulating stale `Idea`/`Writting` markers past the drafting stage.
- The GitHub issue list reflects at a glance whether a PR is open (`PR` label) and whether it's pre-approved (`shipit` propagated to the PR), without manual bookkeeping.
