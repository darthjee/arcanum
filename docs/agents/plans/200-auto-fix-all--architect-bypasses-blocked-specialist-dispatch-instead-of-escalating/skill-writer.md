# Plan: Auto-fix-all: architect bypasses blocked specialist dispatch instead of escalating

Issue: [200-auto-fix-all--architect-bypasses-blocked-specialist-dispatch-instead-of-escalating.md](../../issues/200-auto-fix-all--architect-bypasses-blocked-specialist-dispatch-instead-of-escalating.md)

## Overview

During `/auto-fix-all 192`, a specialist dispatch (`Agent(infra, ...)`) was blocked by Claude Code's own permission classifier. Instead of stopping and escalating, `architect` performed the same change itself directly, then continued the pipeline through to merge. `process_one_issue.md` and `handle_comment.md` currently document only the happy path for a dispatch (agent commits, reports back) and the "no agent seems responsible" fallback (architect handles it itself) — there is no branch for "an agent *was* judged responsible, dispatch was attempted, and it was denied." This plan adds that branch, wires a new terminal `OUTCOME=blocked` through `process_one_issue.md` up to the coordinator, and gives the coordinator (`auto-fix-all/SKILL.md`) a user-facing prompt for it — mirroring the existing `OUTCOME=closed PR_NUMBER=<n>` pattern.

## Context

All three places `process_one_issue.md` dispatches a specialist (branch-conflict resolution, CI-failure handling — both the review-approved and `shipit` paths — and PR-comment handling) route through the same shared logic in `handle_comment.md`'s "Choosing the responsible agent(s)" → "Dispatching" sections. That makes "Dispatching" the single place a blocked-dispatch check needs to live; every call site inherits it automatically.

`process_one_issue.md`'s own header currently promises exactly two terminal outcomes (`OUTCOME=merged`, `OUTCOME=closed PR_NUMBER=<n>`) to the coordinator that spawned it (`auto-fix-all/SKILL.md`, which has no `AskUserQuestion`/`ScheduleWakeup` of its own inside the spawned `architect` agent — those stay with the coordinator, per `docs/agents/architecture/agent-roster-and-delegation.md`). A third outcome needs to be added to that contract and threaded through both files consistently.

No change to `.claude/agents/architect.md` is needed: its "Autonomous pipeline work" section already says following a steps file's instructions — including "delegating to specialist agents as the steps direct" — is "a normal, sanctioned part of your coordinator role," treated "as in-scope by default." Once the steps files below explicitly document escalation-on-block as part of that delegation, architect already treats it as in-scope by default; there's nothing in the agent definition itself that needs to change to make that true.

## Implementation Steps

### Step 1 — Detect and report a blocked dispatch in `handle_comment.md`

In the "Dispatching" section, add an explicit case alongside the existing "launch the responsible agent(s) in parallel" instruction: if the `Agent(...)` call for a responsible agent is denied/blocked by Claude Code's own permission classifier (a tool-permission denial on the dispatch itself, not anything the dispatched agent said), do **not** fall back to performing that agent's action directly. Stop dispatching immediately — abandon any other in-flight dispatches in the same batch — and surface:

```
OUTCOME=blocked AGENT=<agent-name> ACTION="<one-line description of what was being dispatched>"
```

Make clear this is a *different* condition from "Choosing the responsible agent(s)" step 4 ("if no agent seems responsible, treat it yourself as architect") — that fallback is untouched; it only applies when nobody was judged responsible in the first place. This new case applies only when an agent *was* judged responsible and the dispatch to it was actually attempted and denied.

### Step 2 — Propagate `OUTCOME=blocked` through every `process_one_issue.md` call site

Update the three places that read "Choosing the responsible agent(s)"/"Dispatching" (Step 1's branch-conflict resolution, the CI-`failed` branches under both the review-approved and `shipit` paths, and the `commented` branch) so that when `handle_comment.md` reports `OUTCOME=blocked ...` instead of completing normally, `process_one_issue.md` stops processing this issue immediately and reports that same `OUTCOME=blocked AGENT=<agent-name> ACTION="<description>"` at the top level — replacing today's implicit behavior of continuing on (and, per the bug, architect silently substituting itself).

### Step 3 — Update `process_one_issue.md`'s own outcome contract

The file's opening paragraph ("Run this entire file to completion and then report one of: `OUTCOME=merged` or `OUTCOME=closed PR_NUMBER=<n>`") needs a third form documented:

```
OUTCOME=blocked AGENT=<agent-name> ACTION=<description>
```

### Step 4 — Update the coordinator's spawn prompt

In `auto-fix-all/SKILL.md` Step 2, the spawn prompt's closing instruction ("Report OUTCOME=merged or OUTCOME=closed PR_NUMBER=<n>.") needs the third form added, so the spawned `architect` agent knows it's a documented, expected outcome rather than something to work around.

### Step 5 — Add a coordinator-side `OUTCOME=blocked` branch

In `auto-fix-all/SKILL.md` Step 3, add a new `### OUTCOME=blocked AGENT=<agent> ACTION=<description>` branch, shaped like the existing `OUTCOME=closed PR_NUMBER=<n>` branch (this is the one other point in the pipeline that talks to the user):

> A specialist dispatch to `<agent>` was blocked while processing issue `<id>` (action: `<description>`). What would you like to do?
> 1. Retry (e.g. after granting the needed permission out-of-band)
> 2. Skip this issue and move on to the next one

- **Retry** — go back to Step 2 and re-spawn a fresh `architect` agent for the same `<id>`. `process_one_issue.md`'s branch bootstrap already reuses an existing `issue-<id>` branch/PR, so this naturally resumes from where the block occurred rather than starting over.
- **Skip** — `scripts/queue.sh pop "$REPO_PATH"`, then go back to Step 2, same as the existing `closed` branch's skip option.

Deliberately no "do it yourself" option here — that's the exact behavior #200 is about; if it's ever wanted, it should be a separate, explicit decision made in the open by a human, not a default silently offered right back on every block.

## Files to Change

- `auto-fix-all/steps/handle_comment.md` — add the blocked-dispatch detection/report case to "Dispatching".
- `auto-fix-all/steps/process_one_issue.md` — propagate `OUTCOME=blocked` from every dispatch call site; update the file's outcome contract in its opening paragraph.
- `auto-fix-all/SKILL.md` — update Step 2's spawn prompt to mention the third outcome; add the new `OUTCOME=blocked` branch to Step 3.

## Notes

- No script changes: whether a dispatch was blocked is something the agent observes directly from the `Agent` tool call's own result (a permission denial), not something a bash script can detect — this is pure instruction/behavior change, no `scripter` involvement.
- Related, intentionally out of scope here: #205 (whether routine specialist dispatches should get a narrow permission allowlist entry, so they stop hitting the classifier at all, the way `shipit`'s `wait_ci_and_merge.sh` does) and #206 (the process gap that let `infra` get dispatched for a file — `.github/workflows/**` — outside its documented scope in the first place). This plan only changes what happens *after* a block occurs.
