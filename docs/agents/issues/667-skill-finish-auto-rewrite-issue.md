# Issue: Skill finish: auto-rewrite-issue

## Description
Sub-issue of #658. Change `auto-rewrite-issue`'s final step so it ends with the standard finish defined in `docs/agents/specs/skill-finish.md`: a closing report rendered by `arcanum/_lib/finish_report.sh`, with one `Next: /discuss-issue <id>` line per rewritten issue.

The shared scripts (`finish_report.sh`, `finish_report_shell.sh`, native `finish-report`) already exist (delivered with #660), so this issue only changes `auto-rewrite-issue`'s skill files.

## Problem
- `auto-rewrite-issue/steps/run.md` Step 3 ends with a free-form summary (how many ids succeeded, which failed and at which sub-step). There is no fixed format.
- `auto-rewrite-issue/SKILL.md` relays the architect's final report verbatim, but that report is hand-written.
- Unlike the other in-scope skills, this one processes **many** issues per run, while `finish_report.sh` keeps only one `--issue` (last value wins) and `--label-change` lines carry no issue id.

## Expected Behavior
- Every exit path ends with exactly one report printed by `finish_report.sh` with `--skill auto-rewrite-issue`, relayed verbatim as the last thing printed. Per-id failure logs may be printed while draining, but before the report.
- The skill never prompts. There is no `declined` path, since the skill never asks the user anything.
- Nothing nests `auto-rewrite-issue` today, so no `NESTED=true` handling is needed.

### Report content
- **No `--issue` / `--sub-issue`.** The summary line names the rewritten ids and any failed ids with the failing sub-step (fetch, push, tag removal).
- **`Next:` lines:** one `--next "/discuss-issue <id>"` per rewritten issue, in processing order. An issue counts as rewritten once its body push succeeded, even if the tag removal then failed. The summary notes the tag-removal failure.
- **`Labels:`**: pass `--label-change created:` **once** when at least one `created` tag removal succeeded. Omit it otherwise.

### Status
- **Empty queue** (nothing popped): `success`, with a summary like "Rewrite queue was empty; nothing to do." and no `--next` or `--label-change`.
- **At least one id rewritten**: `success`, even if other ids failed. The failed ids are named in the summary. They need no action here: `monitor-issues` re-detects the `created` tag and re-queues them on its own.
- **Ids popped but none rewritten**: `failed`, with no `--next`. The summary names each id and its failing sub-step.
- `rewrite_queue.sh pop` exits 1 both for an empty queue and on error, so an unreadable queue can't be told apart from an empty one. Do not add a separate branch for it.

Example:

```text
== auto-rewrite-issue: SUCCESS ==
Rewrote 2 of 3 queued issues (#101, #102); #103 failed at push.
Labels: Created -> (none)
Next: /discuss-issue 101
Next: /discuss-issue 102
```

## Solution
Owner: `skill-writer` (skill markdown only; no script changes).

- In `auto-rewrite-issue/steps/run.md`, track rewritten, tag-removed and failed ids (with their failing sub-step) while draining (Steps 1–2).
- Replace Step 3 with a `Closing report` section that applies the rules above and calls:

  ```bash
  ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-rewrite-issue --status success|failed \
    --summary "<one line>" [--label-change created:] [--next "/discuss-issue <id>"]...
  ```

  (resolved relative to the `auto-rewrite-issue` skill folder).
- If `finish_report.sh` itself exits non-zero, say in one line that the closing report could not be rendered, and end (same rule as `auto-plan-issue`).
- Adjust `auto-rewrite-issue/SKILL.md` wording if needed so the coordinator relays the report block as-is.

### Acceptance criteria
- [ ] `auto-rewrite-issue` ends with the standard closing report on every exit path (success, including empty queue, and failed)
- [ ] One `Next: /discuss-issue <id>` line per rewritten issue on success, and none on failed
- [ ] `Labels: Created -> (none)` appears once when at least one tag was removed

## Benefits
- `auto-rewrite-issue` ends like every other in-scope skill, so users and callers read one format.
- The `Next:` lines hand each rewritten issue straight to `/discuss-issue`.
