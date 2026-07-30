# Plan: Remove emoji - tags pairing

Issue: [104-remove-emoji---tags-pairing.md](../issues/104-remove-emoji---tags-pairing.md)

## Overview
Body-emoji parsing for issue tags was already removed in Fix #90 — tag state is tracked purely via GitHub labels today. The only remaining vestige is that the canonical tag identifiers in `_lib/tags.sh` (and every place that references them) are still named after gemoji shortcodes. This plan renames the four identifiers that are true emoji-shortcode leftovers — `pencil2` → `created`, `clipboard` → `ready_for_work`, `construction` → `working`, `eyes` → `fetched` — across the shared libs, skill scripts, skill markdown, and docs that reference them, without touching GitHub label names, PR-comment emoji reactions, or the `:shipit:` PR-approval convention.

## Context
`_lib/tags.sh` defines a canonical-tag ↔ GitHub-label mapping (`_tag_label_for` / `_tag_for_label`). Some canonical tag names already read as plain words (`shipit`, `question`, `refined`, `ready`, `enqueued`) and are unaffected. Four of them (`pencil2`, `clipboard`, `construction`, `eyes`) are gemoji shortcodes and are the actual subject of this issue.

Two unrelated emoji mechanisms must NOT be touched:
- PR-comment reactions (`:eyes:`/`:+1:`) in `auto-monitor-pr/scripts/monitor_pr.sh`, its `SKILL.md`/`steps/run.md`, and `README.md`'s description of `/auto-monitor-pr` — these are literal GitHub reaction emojis on PR comments, unrelated to the issue-tag identifiers.
- The `:shipit:` PR-approval-via-comment convention in `auto-monitor-pr/scripts/monitor_pr.sh`.

## Implementation Steps

### Step 1 — Rename identifiers in the shared tag library
In `_lib/tags.sh`, rename the four canonical tag identifiers in both the header comment table and the `_tag_label_for`/`_tag_for_label` case statements: `pencil2` → `created`, `clipboard` → `ready_for_work`, `construction` → `working`, `eyes` → `fetched`. The GitHub label names on the right-hand side (`Created`, `Ready for Work`, `Working`, `Fetched`) do not change.

### Step 2 — Update all call sites in shared libs and skill scripts
Update every reference to the old identifiers to use the new names:
- `_lib/tag_actions.sh` — `ACTIONABLE_TAGS` array and its accompanying comment.
- `_lib/github_issue.sh` — the `pencil2` label-removal call and its warning message.
- `monitor-issues/scripts/monitor_issues.sh` — the `case` branches and log messages for `pencil2`/`clipboard`, and the comment above them.
- `auto-fix-all/scripts/queue.sh` — the `clipboard`/`pencil2` label-removal calls, warning messages, and the comment above them.

### Step 3 — Update skill markdown (steps/SKILL.md)
Update prose and code fences referencing the old identifiers:
- `auto-fix-all/steps/process_one_issue.md` — the `eyes`/`construction` tag add/remove calls and surrounding prose.
- `auto-rewrite-issue/steps/run.md` — all `pencil2` references (tag name, `github.sh remove-tag <id> pencil2` calls, failure-handling prose).
- `auto-rewrite-issue/SKILL.md` — the `pencil2` mention in the description.

### Step 4 — Update project documentation
- `docs/agents/architecture.md` — the canonical-tag/label table and the prose describing `pencil2`, `clipboard`, `eyes`, `construction` (including the `.claude/state/monitor-issues-rewrite-queue.json` row and the `init-claude-config.json` row's `eyes` mention).
- `docs/agents/folder-structure.md` — the `:pencil2:` mention in the `auto-rewrite-issue/` row.
- `README.md` — the `:pencil2:` mention in the `/auto-rewrite-issue` row. Leave the `/auto-monitor-pr` row's `:eyes:`/`:+1:` mention untouched (PR-comment reactions, out of scope).

### Step 5 — Sweep for stragglers
Re-run a repo-wide search for the four old identifiers (word-boundary match, e.g. `grep -rn '\bpencil2\b\|\bclipboard\b\|\bconstruction\b\|\beyes\b'`) after Steps 1-4 to confirm no reference was missed, being careful to distinguish genuine leftovers from unrelated uses of the same plain words (e.g. a future accidental match on the word "eyes" inside PR-reaction code, which must stay as-is).

## Files to Change
- `_lib/tags.sh` — rename the 4 canonical tag identifiers (mapping table + both case statements)
- `_lib/tag_actions.sh` — rename in `ACTIONABLE_TAGS` and comment
- `_lib/github_issue.sh` — rename in the `pencil2` removal call and warning
- `monitor-issues/scripts/monitor_issues.sh` — rename in `case` branches, log messages, comment
- `auto-fix-all/scripts/queue.sh` — rename in removal calls, warnings, comment
- `auto-fix-all/steps/process_one_issue.md` — rename `eyes`/`construction` tag calls and prose
- `auto-rewrite-issue/steps/run.md` — rename `pencil2` references
- `auto-rewrite-issue/SKILL.md` — rename `pencil2` mention
- `docs/agents/architecture.md` — rename in tag/label table and prose
- `docs/agents/folder-structure.md` — rename `:pencil2:` mention
- `README.md` — rename `:pencil2:` mention (leave `/auto-monitor-pr`'s `:eyes:`/`:+1:` untouched)

## Notes
- Do not touch `auto-monitor-pr/scripts/monitor_pr.sh`, `auto-monitor-pr/SKILL.md`, `auto-monitor-pr/steps/run.md`, or README's `/auto-monitor-pr` row — their `:eyes:`/`:+1:` and `:shipit:` usages are PR-comment reaction/approval mechanisms, explicitly out of scope per the issue.
- `shipit`, `question`, `refined`, `ready`, and `enqueued` canonical tag identifiers are already plain words and are not part of this rename.
- No CI config was found in the repo, so there is no automated check to run locally beyond re-grepping for the old identifiers (Step 5) and reading through the changed files.
