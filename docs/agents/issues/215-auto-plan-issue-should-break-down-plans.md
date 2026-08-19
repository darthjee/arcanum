# Issue: auto-plan-issue should break down plans

## Description
Today, `auto-plan-issue` (`steps/write_plan.md`) and `plan-issue` (`steps/write_and_confirm.md`) both break a plan down per specialist agent, writing each agent's full implementation into a single `<agent-name>.md` file that contains every step's description and file list inline, one after another under `## Implementation Steps`. This per-agent split is good and stays as-is — the change here is one level deeper, within a single agent's own plan file.

## Problem
For an agent plan with multiple steps, everything lives in one document that the executing specialist agent (dispatched by `auto-fix-issue`'s `dispatch_agents.md`) loads in full before doing any work — including the full description and file-change list of steps it hasn't started yet. This front-loads context for later steps unnecessarily, working against keeping each specialist's working context minimal and focused on the step actually being implemented.

## Expected Behavior
An agent whose plan has more than 2 steps gets its plan split across multiple files: an index (`<agent-name>.md`) holding only what's needed across all steps, plus one file per step under `<agent-name>/`. When `auto-fix-issue` dispatches that agent, it reads the index once, then processes steps in order — reading, implementing, and committing one step file at a time, never reading ahead into a later step's file before finishing the current one. Checks still run once, after all steps are implemented, matching today's single check-and-fix pass. Plans with 1–2 steps are unaffected — the step content stays inline in the index, exactly as today.

## Solution

### Scope

This change applies to **both** plan-writing skills, not just `auto-plan-issue`:

- `auto-plan-issue` (`steps/write_plan.md`) — autonomous plan authoring.
- `plan-issue` (`steps/write_and_confirm.md`) — interactive plan authoring.

Both currently write the same `<agent-name>.md` shape, and the downstream consumer — `auto-fix-issue`'s `dispatch_agents.md` — reads whichever plan is on disk regardless of which of the two skills produced it. Keeping both producers in sync avoids a shape mismatch and keeps `auto-fix-issue` (and `review_and_redispatch.md`, which re-dispatches against the same plan paths) working against a single consistent shape.

### Split threshold

Splitting into per-step files only happens when an agent's plan has **more than 2 steps** (i.e. 3 or more). For 1 or 2 steps, the step content stays inline in `<agent-name>.md` — no `<agent-name>/` subfolder, no separate step files — since "avoid hoarding context ahead of time" doesn't meaningfully apply when there are only one or two steps the agent reads immediately anyway. This mirrors the existing `AGENT_SPLIT` judgment-call precedent (`determine_agents.md`'s single-owner Case A2, which skips multi-file overhead when there's "nothing to share"). `write_plan.md` / `write_and_confirm.md` need a step-count check per agent, and `dispatch_agents.md`'s instructions need to branch depending on whether `<agent-name>.md`'s `## Steps` section is inline content or a list of links to step files.

### Step file naming convention

Step files use a zero-padded number prefix plus a short descriptive slug:

```
backend/
  01-add-users-endpoint.md
  02-add-validation.md
  03-wire-up-tests.md
```

The numeric prefix makes the files self-sorting on disk (a plain `ls`/glob gives execution order for free, without parsing an index), while the slug keeps each file self-descriptive without opening it, and gives `review_and_redispatch.md` an unambiguous, human-readable target when it needs to re-dispatch a fix against one specific step. This mirrors (in spirit) the existing `arcanum/migrations/repos/<version>/001.md`-style numeric convention already used elsewhere in this repo, while keeping the descriptiveness of the skill `steps/*.md` convention.

### Content split between the agent index and step files

Full split — the agent index (`<agent-name>.md`) keeps only what's genuinely needed across *all* steps; each step file is fully self-contained, including its own scoped file list.

`<agent-name>.md` (index) keeps:
- `Main plan: [plan.md](plan.md)` header link
- `## Shared contracts` (cross-agent interface, unchanged from today)
- `## Steps` — an ordered list of links, one per step file, e.g. `- [01 — Add endpoint](<agent-name>/01-add-endpoint.md)`
- `## CI Checks` (runs once, applies across the whole agent's work)
- `## Notes` (agent-wide caveats, not specific to one step)

`<agent-name>/<step>.md` (per step) contains:
- The step's own description (what was previously the `### Step N — <Name>` body)
- Its own `## Files to Change`, scoped only to that step

### Execution behavior (dispatch_agents.md)

The specialist agent's instructions change from "read your plan file, implement everything in it" to a per-step loop, with checks deferred to the end:

1. Read the agent's index file (`<agent-name>.md`) first — `## Shared contracts`, the ordered `## Steps` list, `## CI Checks`, `## Notes`.
2. For each step, in order — **do not read ahead into a later step's file**:
   - Read only that step's file (e.g. `<agent-name>/01-add-endpoint.md`).
   - Implement it.
   - Commit via `scripts/commit_change.sh` (one commit per step, committed inside the loop, before checks have run).
3. Once every step is implemented and committed, run checks once (`scripts/run_checks.sh <agent-name>`).
4. If checks fail: fix the issue, and commit the fix(es) as additional commits (do not amend the per-step commits) — repeat until clean.
5. Report back as today (what was implemented, files changed, check results, commit hashes).

### Downstream consumer: review_and_redispatch.md

When re-dispatching an agent to fix something, always pass the agent's index file (`<agent-name>.md`, for `## Shared contracts`/context) as before, and additionally call out the specific step file path(s) by name when the discrepancy can be traced to particular step(s) (e.g. "the field name in `backend/02-add-validation.md`'s payload doesn't match the contract"). Falls back to describing the fix in prose only, against just the index, when it doesn't map cleanly to one step.

### Backward compatibility

Clean cutover — `dispatch_agents.md` and `review_and_redispatch.md` do not need to support both the old flat plan shape and the new split shape. Plan directories are transient, per-issue artifacts created by `auto-plan-issue`/`plan-issue` and consumed by `auto-fix-issue` within the same issue-fix cycle, not long-lived config. A follow-up issue, [#217](https://github.com/darthjee/arcanum/issues/217), has been spawned to revisit this assumption once other repos using arcanum have had a chance to pick up the new format.

### Migration needed?

No. Plan directories are transient, per-issue artifacts — not part of arcanum's installed config shape that `arcanum/migrations/repos/<version>/` exists to carry consuming repos through.

## Benefits
- Executing agents load only the current step's context, not the entire plan up front, directly reducing wasted context for multi-step agent work.
- Failures are traceable to a specific step file, giving faster, more isolated feedback during implementation and review.
- `review_and_redispatch.md` can point a re-dispatched fix directly at the offending step file instead of the whole plan.
- `auto-plan-issue` and `plan-issue` stay in sync, so `auto-fix-issue` always consumes one consistent plan shape regardless of which skill produced it.
