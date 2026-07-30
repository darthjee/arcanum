# Plan: Add new usefull labels

Issue: [89-add-new-usefull-labels.md](../../issues/89-add-new-usefull-labels.md)

## Overview
Wire the already-existing `Idea`, `Writting`, and `PR` GitHub labels into the pipeline's tag machinery, clean them up at the right pipeline stage, and add a new informational `auto-shipit` label that mirrors an issue's `shipit` status onto its PR. All changes are confined to shared/skill scripts (no interactive skill-markdown changes needed), so this is a single-agent (scripter) plan.

## Context
`_lib/tags.sh` defines the single source of truth mapping between canonical tag names and GitHub label names, consumed by `_lib/tag_mutate.sh`'s `tag_mutate_add_label`/`tag_mutate_remove_label`. Today it only knows about `created`, `ready_for_work`, `shipit`, `working`, `question`, `fetched`, `refined`, `ready`, `enqueued` — it has no entries for `Idea`, `Writting`, or `PR`, even though those labels already exist on the repo (created by `init-claude`'s `label_config.sh`) and are referenced in the issue's intended workflow.

`_lib/github_issue.sh`'s `cmd_mark_refined` (invoked by `discuss-issue`'s "Push to GitHub" step) currently only removes `created` when adding `refined`. `auto-fix-issue/scripts/github.sh`'s `cmd_pr_create`/`cmd_pr_ready` (invoked by `auto-fix-issue/steps/open_pr.md`) currently never touch issue labels or `.claude/state/issue-<id>.json` at all.

Per discussion, `shipit` itself stays human-only (guarded by `_lib/tag_mutate.sh`, never mutated by scripts) — propagation to the PR uses a brand-new, purely informational label `auto-shipit` (color `ffb004`, already present on GitHub) instead, applied directly via `gh pr edit`, bypassing the shipit guard by construction since it's a different label on a different object (the PR, not the issue).

## Implementation Steps

### Step 1 — Register `idea`, `writting`, and `pr` as canonical tags
In `_lib/tags.sh`, add three entries to both `_tag_label_for` and `_tag_for_label` (mirroring the existing `case` pattern):
- `idea` ↔ `Idea`
- `writting` ↔ `Writting`
- `pr` ↔ `PR`

Update the header comment's mapping table to list the three new rows too.

### Step 2 — Remove `Idea`/`Writting` on refine
In `_lib/github_issue.sh`'s `cmd_mark_refined`, add two more best-effort calls alongside the existing `tag_mutate_remove_label "$id" "$repo_ref" created` line:
```bash
tag_mutate_remove_label "$id" "$repo_ref" idea \
  || echo "Warning: could not remove 'idea' tag from issue #$id on $repo_ref" >&2
tag_mutate_remove_label "$id" "$repo_ref" writting \
  || echo "Warning: could not remove 'writting' tag from issue #$id on $repo_ref" >&2
```
Same idempotent, best-effort semantics as the existing `created` removal — a missing label is not an error.

### Step 3 — Register the `auto-shipit` label with `init-claude`
In `init-claude/scripts/lib/label_config.sh`, add `auto-shipit:ffb004` to the `DEFAULT_LABEL_PAIRS` array, so projects running `init-claude`'s label sync get it created alongside `Idea`/`Writting`/`PR`. This label has no reader anywhere in the pipeline — it exists purely so a developer glancing at the PR's labels can tell the underlying issue already had `shipit`.

### Step 4 — Add a shared helper to resolve the issue id from the current branch
`auto-fix-issue/scripts/github.sh`'s `_persist_pr_state` already extracts the issue id from the branch name via the `^issue-([0-9]+)$` regex. Extract this into a small helper, e.g.:
```bash
_current_issue_id() {
  local branch
  branch=$(git branch --show-current)
  if [[ "$branch" =~ ^issue-([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}
```
and use it both from `_persist_pr_state` and from the new logic in Step 5, to avoid duplicating the regex.

### Step 5 — Sync issue labels/state and add `PR`/`auto-shipit` on PR create/ready
`auto-fix-issue/scripts/github.sh` needs to source `_lib/tags.sh` and `_lib/tag_mutate.sh` (same relative pattern `_lib/github_issue.sh` uses) to reuse `tag_mutate_add_label` and `extract_tags`.

Add a helper, e.g. `_sync_pr_labels_and_state`, called from both `cmd_pr_create` (after a successful `gh pr create`) and `cmd_pr_ready` (after a successful `gh pr ready`), that:
1. Resolves the issue id via `_current_issue_id` (Step 4) — no-op silently if the branch doesn't match `issue-<id>`.
2. Adds the `PR` label to the issue via `tag_mutate_add_label "$id" "$repo_ref" pr` (idempotent).
3. Fetches the issue's current labels (`gh issue view "$id" -R "$repo_ref" --json labels -q '.labels[].name'`), converts them via `extract_tags`, and writes the result to `.claude/state/issue-<id>.json`'s `tags` field via `issue_state.sh set-json <id> tags <json_array>` (same approach `cmd_fetch` in `_lib/github_issue.sh` uses to build `tags_json`).
4. If the refreshed tags include `shipit`, adds the `auto-shipit` label directly to the PR: `gh pr edit -R "$repo_ref" "$branch" --add-label auto-shipit`. Do not route this through `tag_mutate_add_label` — that function only knows how to mutate issue labels (`gh issue edit`), and `auto-shipit` isn't a canonical issue tag; it's PR-only.

All of this should be best-effort/non-fatal, consistent with the rest of the script (label/state sync failures should warn to stderr, not abort an otherwise-successful PR create/ready).

### Step 6 — Document the new tags
In `docs/agents/architecture.md`'s "Issue Tags" section, add rows for `idea`/`Idea`, `writting`/`Writting`, and `pr`/`PR` to the canonical-tag table, plus a short paragraph each (matching the style of the existing `refined`/`ready` paragraphs) explaining:
- `idea`/`writting` are removed by `mark-refined` alongside `created`.
- `pr` is added by `auto-fix-issue`'s `pr-create`/`pr-ready` once a PR exists for the issue.
- `auto-shipit` (mention it's PR-only, not part of the canonical issue-tag table) is a purely informational label with no reader in the pipeline, applied to the PR when the issue has `shipit`.

## Files to Change
- `_lib/tags.sh` — add `idea`, `writting`, `pr` canonical tag mappings.
- `_lib/github_issue.sh` — `cmd_mark_refined` also removes `idea`/`writting`.
- `init-claude/scripts/lib/label_config.sh` — add `auto-shipit:ffb004` to `DEFAULT_LABEL_PAIRS`.
- `auto-fix-issue/scripts/github.sh` — source `_lib/tags.sh`/`_lib/tag_mutate.sh`; extract `_current_issue_id`; add label/state sync logic to `cmd_pr_create` and `cmd_pr_ready`.
- `docs/agents/architecture.md` — document the three new canonical tags and the `auto-shipit` PR-only label.

## Notes
- `auto-shipit` is deliberately kept out of `_lib/tags.sh`'s canonical table — it's not an issue-label concept (it's never read from or written to an issue, only to PRs), so forcing it into that table would misrepresent what `has_tag`/`extract_tags` mean.
- The `shipit` guard in `_lib/tag_mutate.sh` is untouched by this issue — `auto-shipit` mutation happens via a direct `gh pr edit` call in `auto-fix-issue/scripts/github.sh`, not through the shared guarded library.
- No CI workflow exists in this repo to add a `## CI Checks` section for.
