# Plan: Add :eyes: tag when starting processing the issue

Issue: [51-add--eyes--tag-when-starting-processing-the-issue.md](../../issues/51-add--eyes--tag-when-starting-processing-the-issue.md)

## Overview

Give the `auto-fix-all` pipeline a way to push status tags back onto the live GitHub issue so the issue list itself reflects progress: `:eyes:` while the issue is being fetched/checked, swapped for `:construction:` once the implementation plan is written and coding is about to start. This requires generalizing the tag-mutation logic that today only exists as `remove-tag` (duplicated ad hoc) into shared `add-tag`/`remove-tag` primitives, registering the two new tags as canonical aliases in `_lib/tags.sh`, and wiring the two call sites into the existing `auto-new-issue`/`auto-plan-issue` flows.

## Context

- `_lib/tags.sh` already exposes `extract_tags`/`has_tag`, with three emoji aliases (`❓`/`question`, `✏️`/`pencil2`, `📋`/`clipboard`) normalized internally.
- `monitor-issues/scripts/github.sh` implements `remove-tag` end-to-end today: fetch issue body via `gh issue view`, strip the tag from the trailing `Tags:` block (dropping the whole block if it becomes empty), then push via `gh issue edit --body-file`. This logic is GitHub-fetch/push plumbing, not specific to `monitor-issues` — it needs to move to a shared location so `auto-new-issue` and `auto-plan-issue` can reuse it without re-fetching/re-implementing it.
- `auto-new-issue/scripts/github.sh fetch <id>` is the call site for `:eyes:` — it already fetches the issue body and extracts/strips any trailing tags block, but never writes anything back to GitHub.
- `auto-fix-all/steps/process_one_issue.md` step 2 calls `auto-new-issue/steps/run.md` (fetch happens inside `auto-new-issue`'s own flow), and step 3 calls `auto-plan-issue/steps/run.md` (plan-writing). The `:construction:` swap belongs at the very end of `auto-plan-issue`'s flow, right after the plan is committed.
- This applies only to the `auto-fix-all` pipeline, not the manual `/new-issue`, `/plan-issue`, or `/discuss-issue` skills — so the new tag-mutation calls must be added inside `auto-fix-all`'s own orchestration (or guarded so manual skills don't trigger them), not inside `auto-new-issue`/`auto-plan-issue`'s shared `steps/run.md` files that the manual skills also read.
- No CI workflow config exists in this repo (no `.github/workflows`), so there is no `## CI Checks` section to populate — verification is manual (`bash -n` / shellcheck-style sanity checks on edited scripts) as is convention elsewhere in this repo.

## Implementation Steps

### Step 1 — Register the new tag aliases in `_lib/tags.sh`

Add `:eyes:`/👀 and `:construction:`/🚧 to the emoji-alias normalization in `extract_tags`, following the exact pattern already used for `❓`/`question`, `✏️`/`pencil2`, `📋`/`clipboard`. Update the function's doc comment to list the two new aliases.

### Step 2 — Extract shared `add-tag`/`remove-tag` primitives into `_lib/`

Create a new sourced library (e.g. `_lib/tag_mutate.sh`) that generalizes the GitHub fetch -> mutate -> push sequence currently living in `monitor-issues/scripts/github.sh`'s `cmd_remove_tag`/`strip_tag_from_body`. It should expose:
- A function to add a tag to a body's trailing `Tags:` block (creating the block if absent, appending the tag if the block exists but lacks it, no-op if already present).
- A function to remove a tag from a body's trailing `Tags:` block (the existing `strip_tag_from_body` behavior — drop the whole block if empty after removal).
- A higher-level "fetch issue body, mutate, push via `gh issue edit`" helper that both `add-tag` and `remove-tag` commands can call, parametrized by which mutation function to apply.

Keep the emoji-alias table (`question`/`pencil2`/`clipboard`/`eyes`/`construction` -> emoji) in one place so both add and remove paths agree on which emoji form corresponds to which canonical tag name.

### Step 3 — Update `monitor-issues/scripts/github.sh` to use the shared library

Replace the inline `strip_tag_from_body`/`cmd_remove_tag` implementation with calls into the new `_lib/tag_mutate.sh` functions, keeping the same CLI usage (`github.sh remove-tag <id> <tag>`) and output/error messages so existing callers and tests of this script are unaffected.

### Step 4 — Add an `add-tag` command, exposed where `auto-fix-all` can call it

Add a small script (e.g. `auto-fix-all/scripts/github.sh` if one doesn't already exist for this purpose, or extend an existing `auto-fix-all` script) with commands:
- `add-tag <id> <tag>` — fetch the issue, add the tag, push.
- `remove-tag <id> <tag>` — same shape as `monitor-issues/scripts/github.sh remove-tag`, reusing `_lib/tag_mutate.sh`.

Both delegate to `_lib/tag_mutate.sh`; this script is just the CLI entry point scoped to `auto-fix-all`'s usage (fetch/push by numeric GitHub id, same as `monitor-issues/scripts/github.sh` does).

### Step 5 — Wire the `:eyes:` tag into `auto-fix-all`'s flow around the fetch step

In `auto-fix-all/steps/process_one_issue.md` step 2 (right after — or wrapping — the call into `auto-new-issue/steps/run.md`), add a call to the new `add-tag <id> eyes` command so the GitHub issue gets `:eyes:` pushed once it has been fetched/checked. This must live in `auto-fix-all`'s own step file, not inside `auto-new-issue/steps/run.md`, so the manual `/new-issue` skill (which also reads that shared flow) is unaffected.

### Step 6 — Wire the `:eyes:` -> `:construction:` swap at the end of the plan step

In `auto-fix-all/steps/process_one_issue.md` step 3 (right after the call into `auto-plan-issue/steps/run.md` returns, i.e. after the plan has been committed), add calls to:
- `remove-tag <id> eyes`
- `add-tag <id> construction`

(or a single combined helper if that reads more cleanly) to signal that triage is done and implementation is starting. Again, this must live in `auto-fix-all`'s step file, not inside `auto-plan-issue/steps/run.md`.

### Step 7 — Update architecture docs

Update `docs/agents/architecture.md`'s "Issue Tags" section to document `:eyes:`/👀 and `:construction:`/🚧 alongside the existing three tags, including that they are pipeline-status tags mutated by `auto-fix-all` itself (not actionable tags detected by `monitor-issues`), and note the new shared `_lib/tag_mutate.sh` add-tag/remove-tag primitives alongside the existing lock-system/script-preference guidance.

## Files to Change

- `_lib/tags.sh` — register `:eyes:`/👀 and `:construction:`/🚧 emoji aliases in `extract_tags`.
- `_lib/tag_mutate.sh` (new) — shared `add-tag`/`remove-tag` primitives (body mutation + fetch/push via `gh issue edit`), generalized out of `monitor-issues/scripts/github.sh`.
- `monitor-issues/scripts/github.sh` — refactor `cmd_remove_tag`/`strip_tag_from_body` to call into `_lib/tag_mutate.sh` instead of implementing the logic inline.
- `auto-fix-all/scripts/github.sh` (new, or extended if a generic command script already exists there) — `add-tag`/`remove-tag` CLI commands for `auto-fix-all` to call, delegating to `_lib/tag_mutate.sh`.
- `auto-fix-all/steps/process_one_issue.md` — add the `:eyes:` push after step 2 (issue fetch) and the `:eyes:` -> `:construction:` swap after step 3 (plan commit).
- `docs/agents/architecture.md` — document the two new tags and the shared tag-mutation primitives.

## Notes

- Keep the existing `remove-tag` CLI usage/output strings in `monitor-issues/scripts/github.sh` unchanged after the refactor, so this is a pure internal extraction with no behavior change for existing callers.
- `:eyes:`/`:construction:` are pipeline-status tags, distinct in purpose from the three `ACTIONABLE_TAGS` in `_lib/tag_actions.sh` (`question`, `pencil2`, `clipboard`) — they should NOT be added to `ACTIONABLE_TAGS`, since `monitor-issues` does not need to act on them; they exist purely for human visibility on the GitHub issue list.
- Double-check `gh issue edit --body-file` behavior when the issue body has no trailing `Tags:` block yet (the `add-tag` case for a freshly filed issue) — the shared `add-tag` function must create the `---`/`Tags:` block from scratch in that case, mirroring how `extract_tags_block`/`strip_tags_block` in `auto-new-issue/scripts/github.sh` already detect the block's absence.
- If a generic `auto-fix-all/scripts/github.sh` for issue-tag mutation does not cleanly fit alongside existing `auto-fix-all/scripts/*.sh` naming, consider naming it `tag.sh` instead — final naming is an implementation judgment call for whoever picks up Step 4, as long as `process_one_issue.md`'s invocation in Step 5/6 matches whatever name is chosen.
