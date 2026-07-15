# Plan: Update labels when processing issues

Issue: [97-update-labels-when-processing-issues.md](../../issues/97-update-labels-when-processing-issues.md)

## Overview

Wire two new label transitions into existing scripts: `discuss-issue` marks an issue `Ready` (removing `Created`) once it pushes the finalized draft to GitHub, and the queue system (`auto-fix-all`, `monitor-issues`, `push-issue-to-queue` — all of which funnel through `auto-fix-all/scripts/queue.sh`) marks an issue `Enqueued` (removing `Ready for Work`/`Created`) whenever an id is added to the queue. Both transitions reuse the existing `_lib/tag_mutate.sh` primitives and fail soft (warn, don't block) on `gh` errors.

## Context

`_lib/tags.sh` currently maps six canonical tags to GitHub labels (`pencil2`→`Created`, `clipboard`→`Ready for Work`, `shipit`→`shipit`, `construction`→`Working`, `question`→`Question`, `eyes`→`Fetched`), and `_lib/tag_mutate.sh` exposes `tag_mutate_add_label`/`tag_mutate_remove_label` on top of that table. Both `Ready` and `Enqueued` already exist in `init-claude`'s default label config (`init-claude/scripts/lib/label_config.sh`), so no label-config work is needed — only the tag-table entries and the call sites.

Two constraints from discussion:
- `_lib/github_issue.sh`'s `cmd_update` is shared with `auto-new-issue` (which syncs freshly authored issues) — it must NOT start marking those issues `Ready`. The `Ready`/`Created` swap therefore lives in a new, separate `mark-ready` subcommand that only `discuss-issue` calls.
- `auto-fix-all`'s initial queue seed (`queue.sh save`) and `monitor-issues`/`push-issue-to-queue`'s appends (`queue.sh push`) are the only two places ids ever enter the queue, so the `Enqueued`/`Ready for Work`/`Created` swap is centralized once inside `queue.sh`, not duplicated in the three calling skills.
- Label mutation failures (e.g. a transient `gh`/GitHub API error) must never block the primary action (the queue write, or the issue sync) — warn to stderr and continue.

## Implementation Steps

### Step 1 — Add the two new canonical tags

In `_lib/tags.sh`, add `ready`→`Ready` and `enqueued`→`Enqueued` to both `_tag_label_for` and `_tag_for_label`'s case statements, and to the header comment's mapping table.

### Step 2 — Add a `mark-ready` subcommand to `_lib/github_issue.sh`

Add `cmd_mark_ready`: takes `<id>`, resolves `repo_ref` the same way the other commands do, sources `_lib/tag_mutate.sh` (mirroring the existing `tags.sh` source at the top of the file), then calls `tag_mutate_add_label <id> <repo_ref> ready` and `tag_mutate_remove_label <id> <repo_ref> pencil2`, each wrapped so a failure prints a warning to stderr but does not propagate as a hard error — `cmd_mark_ready` always exits 0. Wire it into the `case` dispatcher and the usage/help text (`mark-ready <id>  Add the Ready label and remove Created, if present`).

### Step 3 — Centralize the enqueue-time label swap in `queue.sh`

In `auto-fix-all/scripts/queue.sh`, source `_lib/origin.sh`, `_lib/tags.sh`, and `_lib/tag_mutate.sh` (paths relative to `SCRIPT_DIR`, same pattern `_lib/github_issue.sh` already uses). Add a helper, e.g. `_mark_enqueued <id...>`, that for each id calls `tag_mutate_add_label <id> "$(get_repo_ref)" enqueued`, `tag_mutate_remove_label <id> "$(get_repo_ref)" clipboard`, and `tag_mutate_remove_label <id> "$(get_repo_ref)" pencil2`, each wrapped to warn-not-fail (same pattern as Step 2). Call `_mark_enqueued "$@"` at the end of both the `save` case (using the ids captured before they're consumed — `save` currently uses `$@` directly in the `jq` pipeline, so capture them into a variable first) and the `push` case (after the ids are appended, using the same ids passed to `push`).

### Step 4 — Call `mark-ready` from `discuss-issue`

In `discuss-issue/steps/discuss_and_save.md`'s "Push to GitHub" section, add a line right after the existing `../scripts/github.sh update <id> "<Title>" <issue_file_path>` call:

```bash
../scripts/github.sh mark-ready <id>
```

No change needed to `discuss-issue/scripts/github.sh` itself — it already forwards all arguments to `_lib/github_issue.sh`, so the new subcommand is available automatically.

### Step 5 — Update architecture docs

In `docs/agents/architecture.md`'s "Issue Tags" section, add `ready`→`Ready` and `enqueued`→`Enqueued` rows to the canonical-tag table, and a short paragraph (matching the style of the existing `pencil2`/`clipboard` paragraphs) describing: `mark-ready` is called by `discuss-issue` right after syncing the finalized issue to GitHub; the enqueue swap lives inside `queue.sh`'s `save`/`push` cases and therefore applies uniformly whether the id arrived via `auto-fix-all`'s initial seed, `monitor-issues`, or `push-issue-to-queue`; both mutations are best-effort (a `gh` failure logs a warning and does not block the underlying operation).

## Files to Change

- `_lib/tags.sh` — add `ready`/`enqueued` canonical-tag entries.
- `_lib/github_issue.sh` — add `cmd_mark_ready`, wire into dispatcher and usage text.
- `auto-fix-all/scripts/queue.sh` — source `_lib/origin.sh`, `_lib/tags.sh`, `_lib/tag_mutate.sh`; add `_mark_enqueued` helper; call it from `save` and `push`.
- `discuss-issue/steps/discuss_and_save.md` — add the `mark-ready` call to the "Push to GitHub" section.
- `docs/agents/architecture.md` — document the two new tags and both call sites in "Issue Tags".

## Notes

- No new label-config work: `Ready` and `Enqueued` are already in `init-claude`'s `DEFAULT_LABEL_PAIRS`.
- `queue.sh`'s `save`/`push` currently have no GitHub-network dependency at all (pure local JSON + lock file) — this introduces one. Since mutations are best-effort/non-blocking, a `gh` outage degrades to "queue updated, labels temporarily stale" rather than breaking the queue.
- No test suite exists in this repo (markdown/bash skills project) — verification is manual (run the updated scripts against a real or scratch issue and confirm the label transitions via `gh issue view`).
