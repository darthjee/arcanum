# Skill-writer Plan: Skill finish: auto-rewrite-issue

Main plan: [plan.md](plan.md)

## Overview
`auto-rewrite-issue` drains the `monitor-issues` rewrite queue and today ends with a hand-written summary (`auto-rewrite-issue/steps/run.md` Step 3). Make every exit end with exactly one report printed by `arcanum/_lib/finish_report.sh`, relayed verbatim, following the rules settled in the issue. The shared scripts already exist (#660). Use `auto-plan-issue/steps/run.md`'s `## Closing report` section as the style reference.

## Context
- This skill handles **many** issues per run. `finish_report.sh` keeps only the last `--issue`, and `--label-change` lines carry no issue id. So the report passes no `--issue`/`--sub-issue`: the rewritten and failed ids go in the summary, and each rewritten id gets its own `--next`.
- The skill never prompts, so there is no `declined` status. Nothing nests it, so no `NESTED=true` handling is needed.
- `rewrite_queue.sh pop` exits 1 both for an empty queue and on error, so no separate "queue unreadable" branch is needed.

## Implementation Steps

### Step 1 — Track per-id outcomes and add the closing report in `run.md`
In `auto-rewrite-issue/steps/run.md`:

1. **Step 2 (process one id):** tell the architect to record each popped id's outcome while draining:
   - **rewritten**: the body push (`gh issue edit`) succeeded;
   - **tag removed**: the `remove-tag ... created` call also succeeded;
   - **failed at `<sub-step>`**: `fetch`, `rewrite/push`, or `tag removal`. A tag-removal failure still counts as **rewritten**.
   Keep the existing "log the failure and move on" / no-re-queue rules unchanged.
2. **Replace Step 3** with a `## Step 3 — Closing report` (or a `## Closing report` section that Step 3 points to), matching the `auto-plan-issue` style:

   ```bash
   ../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-rewrite-issue --status success|failed \
     --summary "<one line>" [--label-change created:] [--next "/discuss-issue <id>"]...
   ```

   > Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-rewrite-issue` skill folder.

   Rules to state explicitly:
   - **Empty queue** (nothing popped): `--status success`, summary like `Rewrite queue was empty; nothing to do.`, no `--next`, no `--label-change`.
   - **At least one id rewritten**: `--status success`. The summary names the rewritten ids and each failed id with its sub-step, e.g. `Rewrote 2 of 3 queued issues (#101, #102); #103 failed at push.` Pass one `--next "/discuss-issue <id>"` per rewritten id, in processing order. Failed ids need no action: `monitor-issues` re-queues them on its own.
   - **Ids popped but none rewritten**: `--status failed`, with the summary naming each id and its failing sub-step. No `--next`.
   - `--label-change created:` is passed **once**, only when at least one tag removal succeeded (it renders `Labels: Created -> (none)`).
   - No `--issue`, `--sub-issue`, `--pr`, or `--nested`. There is no `declined` status, because the skill never asks the user anything.
   - Per-id failure logs may be printed while draining, but the report's stdout is relayed **verbatim** as the last thing printed. Never hand-format, extend, or paraphrase it.
   - If `finish_report.sh` itself exits non-zero, say in one line that the closing report could not be rendered, and end.
   - Include the example block from the issue.

### Step 2 — Align `SKILL.md` relay wording
In `auto-rewrite-issue/SKILL.md`, keep the architect delegation. Reword the final line so the coordinator relays the architect's final output, which is the closing report block, verbatim as its last output, with nothing added. Keep the existing verbatim rule; make only the minimal wording change needed.

## Files to Change
- `auto-rewrite-issue/steps/run.md`: record per-id outcomes in Step 2; replace Step 3 with the closing-report rules and `finish_report.sh` call.
- `auto-rewrite-issue/SKILL.md`: minor relay-wording alignment.

## CI Checks
None apply. CI lint/test jobs run in `core/` only, and this change is skill markdown. `docs/agents/tag-mutations.md` already lists `auto-rewrite-issue` removing `created`, and that doesn't change.

## Notes
- Don't touch `finish_report.sh`, `monitor-issues` scripts, or the spec. #668 moves the spec's lasting rules into `docs/agents/architecture/` later.
- Keep the summary to one line even with many ids. `finish_report.sh` trims it but doesn't wrap it.
