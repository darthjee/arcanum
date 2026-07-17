# Plan: Add Refined Label

Issue: [101-add-refined-label.md](../issues/101-add-refined-label.md)

## Overview

Split the current single `Ready` label into two stages: `Refined` (issue discussed/confirmed, no plan yet) and `Ready` (issue + plan committed and pushed, actually pickable for implementation). `discuss-issue`'s "Push to GitHub" step now applies `Refined` instead of `Ready`; its planning-confirmation flow (step 8) swaps `Refined` for `Ready` right after pushing the `issue-<id>` branch with the committed issue and plan. `init-claude`'s default label set gains the new `Refined` label.

## Context

`_lib/github_issue.sh`'s `mark-ready` subcommand currently adds `Ready` and removes `Created` (`pencil2`), called by `discuss-issue/steps/discuss_and_save.md`'s "Push to GitHub" step right after `update` succeeds. This happens before any plan exists, so `Ready` doesn't reliably mean "ready to implement". The same skill, later in its own run (step 8, reached only if the user confirms planning), checks out `issue-<id>`, commits the issue file (`auto-new-issue/scripts/commit_issue.sh`), writes and commits a plan (`auto-plan-issue/steps/run.md`), then runs a plain `git push` — that push is the actual "ready for `auto-fix-all`/`auto-fix-issue`" moment and is where the `Refined` → `Ready` swap belongs.

Canonical tag/label mapping lives in `_lib/tags.sh` and is documented in `docs/agents/architecture.md`'s "Issue Tags" section — both need the new `refined` ↔ `Refined` entry.

## Implementation Steps

### Step 1 — Add the `refined` canonical tag

In `_lib/tags.sh`:
- Add `refined` → `Refined` to `_tag_label_for`'s case statement.
- Add `Refined` → `refined` to `_tag_for_label`'s case statement.
- Add a `refined         Refined` row to the header comment's mapping table.

### Step 2 — Repurpose/split `_lib/github_issue.sh`'s mark-ready command

- Rename the existing `cmd_mark_ready` function to `cmd_mark_refined`: it still removes `pencil2`, but now adds `refined` instead of `ready`.
- Add a new `cmd_mark_ready` function: adds `ready` and removes `refined` (best-effort, same pattern as the existing function — a `gh` failure on either mutation prints a `Warning:` to stderr and does not block the other mutation or exit non-zero).
- Update the `case` dispatch at the bottom to route both `mark-refined` and `mark-ready` to their respective functions, and update the header usage comment and the `Commands:` usage text printed on invalid input to document both subcommands.

`discuss-issue/scripts/github.sh` is a thin wrapper that `exec`s straight into this file, so no change is needed there — both subcommands become available through it automatically.

### Step 3 — Wire the two calls into `discuss-issue`

In `discuss-issue/steps/discuss_and_save.md`:
- "Push to GitHub" section: change `../scripts/github.sh mark-ready <id>` to `../scripts/github.sh mark-refined <id>`, and update the surrounding prose (currently: `mark-ready adds the Ready label and removes Created, if present`) to describe the new `mark-refined` behavior instead.
- Step 8, "Exit 0 (yes)" list: right after item 4 (`git push` to push the plan commit), insert a new item that runs `../scripts/github.sh mark-ready <id>` to swap `Refined` for `Ready` now that the issue + plan are committed and pushed. Renumber the trailing "Report..." item accordingly.

### Step 4 — Update the architecture doc

In `docs/agents/architecture.md`'s "Issue Tags" section:
- Add a `| \`refined\` | \`Refined\` |` row to the canonical-tag table (after `eyes`/`Fetched`, before `ready`/`Ready`, to match the pipeline order discussed/refined → ready).
- Add a new paragraph (alongside the existing `**eyes**`/`**construction**` and `**ready**`/`**enqueued**` paragraphs) describing `refined`: applied by `_lib/github_issue.sh`'s `mark-refined` subcommand, called by `discuss-issue`'s "Push to GitHub" step right after `update` succeeds — adds `Refined` and removes `Created`, if present.
- Update the existing `**ready**` paragraph: it's now applied by `_lib/github_issue.sh`'s `mark-ready` subcommand, called by `discuss-issue`'s step 8 right after the `git push` that publishes the `issue-<id>` branch with the committed issue + plan — it adds `Ready` and removes `Refined`, if present (not `Created` anymore).

### Step 5 — Add the `Refined` label to init-claude's defaults

In `init-claude/scripts/lib/label_config.sh`, add `Refined:418193` to the `DEFAULT_LABEL_PAIRS` array, so `label_config_ensure_defaults` (and therefore `sync_labels.sh`) creates it on any target repo along with the other standard labels.

## Files to Change

- `_lib/tags.sh` — add the `refined`/`Refined` canonical-tag mapping (both directions) and header table row.
- `_lib/github_issue.sh` — split `cmd_mark_ready` into `cmd_mark_refined` (add `refined`, remove `pencil2`) and a new `cmd_mark_ready` (add `ready`, remove `refined`); update `case` dispatch and usage text.
- `discuss-issue/steps/discuss_and_save.md` — call `mark-refined` in "Push to GitHub"; call `mark-ready` after the step 8 `git push`.
- `docs/agents/architecture.md` — add the `refined` row and paragraph to "Issue Tags"; update the `ready` paragraph to reflect its new trigger point and removed label.
- `init-claude/scripts/lib/label_config.sh` — add `Refined:418193` to `DEFAULT_LABEL_PAIRS`.

## Notes

- `discuss-issue/scripts/github.sh` needs no change — it already `exec`s straight into `_lib/github_issue.sh`, so both `mark-refined` and `mark-ready` subcommands pass through automatically.
- If the user answers "No" to the step 8 planning-confirmation question, the issue stays `Refined` (never reaches `Ready`) until a plan is eventually committed and pushed through this same path — this is intentional per the issue's problem statement, not a gap to fix here.
- `auto-fix-all`'s own pipeline (`process_one_issue.md`) uses the separate `eyes`/`construction` tags and never touches `Refined`/`Ready` — out of scope for this issue.
