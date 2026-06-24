# Plan: Ensure auto-fix-all Uses Architect

Issue: [45-ensure-auto-fix-all-uses-architect.md](../issues/45-ensure-auto-fix-all-uses-architect.md)

## Overview

Today, `auto-fix-all`, `auto-new-issue`, `auto-plan-issue`, `auto-fix-issue`, `auto-monitor-pr`, and `auto-monitor-issue-pr` only *say* "You are acting as the architect" in their `SKILL.md` — when invoked via the `Skill` tool (a human typing `/auto-fix-all ...`, or `/loop` re-entering after a `ScheduleWakeup`), the steps actually run in the general/coordinator context, not in a real, isolated `architect` subagent. Nested calls between these skills (e.g. `auto-fix-all` reading `auto-new-issue/SKILL.md`) already happen via a plain `Read` + "follow these steps", inside whichever context invoked the outer skill — so today that's also the general context.

This plan splits each of the six skills into two layers:
- **`SKILL.md` (coordinator layer)** — thin. Parses arguments, then spawns `Agent(subagent_type: "architect", ...)` to do the real work, waits for it, and relays its report. Keeps only what `architect`'s tool set (`Read, Edit, Write, Bash, Agent` — no `ScheduleWakeup`, no `AskUserQuestion`) cannot do itself.
- **`steps/run.md` (architect layer)** — contains exactly what is today's `SKILL.md` body (Steps 1..N, unchanged). This is what the spawned `architect` agent reads and follows, and it's also what nested callers (already running inside an architect agent) read directly — no second spawn, no double-nesting.

This isolates the architect's reasoning context per top-level invocation (and, for `auto-fix-all`, per issue) from the general coordinator's, satisfying the issue's goal without changing any of the deterministic script logic.

## Context

`architect` is defined in `.claude/agents/architect.md` with `tools: Read, Edit, Write, Bash, Agent` — it can read/write files, run scripts, and spawn further specialist agents (e.g. `scripter`, or per-layer agents dispatched by `auto-fix-issue`'s `dispatch_agents.md`), but it has **no** `ScheduleWakeup` and **no** `AskUserQuestion`. Two places in the current flow need exactly those tools:
- `auto-fix-all`'s `clear_context` handling (`ScheduleWakeup(... prompt="/auto-fix-all" ...)` after a merge, per `monitor_pr.md`).
- `auto-fix-all`'s "PR closed without merging" question to the user (the one interactive point in the whole pipeline, per `monitor_pr.md`).

Both must stay in `auto-fix-all`'s coordinator layer (`SKILL.md`), not move into the architect-delegated part.

## Implementation Steps

### Step 1 — Five straightforward skills: auto-new-issue, auto-plan-issue, auto-fix-issue, auto-monitor-pr, auto-monitor-issue-pr

For each of these five skill folders:

1. Move the current `SKILL.md` body (everything after the frontmatter) verbatim into a new `steps/run.md`, unchanged — same `## Step N` headings, same script invocations, same relative links to other aux files in `steps/` (those links don't need updating, since `run.md` lives in the same `steps/` folder they already point into... except `auto-monitor-issue-pr/SKILL.md`, which has no separate `steps/` folder yet — create one).
2. Replace `SKILL.md`'s body with a coordinator wrapper:

   ```markdown
   You are the coordinator. Delegate this skill's work to the architect agent — do not perform the steps yourself.

   Spawn:

   > Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `<skill-name>` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

   Wait for the agent to finish, then relay its final report to the user verbatim — do not summarize or reinterpret it.
   ```

   (substitute `<skill-name>` with the actual folder name in each case).
3. Keep the frontmatter (`name`, `description`) exactly as-is — these are unaffected by who executes the steps.

### Step 2 — auto-fix-all: split coordinator concerns from architect concerns

`auto-fix-all` is different because two specific interaction points (`ScheduleWakeup`, asking the user about a closed PR) must stay outside the architect delegation.

1. Create `auto-fix-all/steps/process_one_issue.md` containing a merged, self-contained version of today's `process_next.md` + `monitor_pr.md`, minus the two coordinator-only branches:
   - Keep: get-next-id is **not** included here (the coordinator still does `queue.sh wait-next` itself, since it needs the id before deciding whether to spawn the architect at all — see below); branch checkout, running `auto-new-issue`/`auto-plan-issue`/`auto-fix-issue` (now via their `steps/run.md`, per Step 1 above), pre-approval check, blocking on `auto-monitor-issue-pr` (via its `steps/run.md`), and the full `commented`/CI-failure handling loops (these don't need `ScheduleWakeup` or the user — they're autonomous today and stay autonomous).
   - On `merged` or on the "approved → cleanup → CI → merge" path succeeding: stop and report `OUTCOME=merged`.
   - On `closed`: stop and report `OUTCOME=closed PR_NUMBER=<n>` — do **not** ask the user (architect has no `AskUserQuestion`).
2. Rewrite `auto-fix-all/SKILL.md` as the coordinator:
   - Step 1 (queue init) stays exactly as today.
   - Step 2 loop:
     ```
     id = queue.sh wait-next   (blocks until the queue has something)
     Spawn Agent(subagent_type: "architect", prompt: "Read steps/process_one_issue.md (resolved relative to the auto-fix-all skill folder) and follow it for issue <id>. Report OUTCOME=merged or OUTCOME=closed PR_NUMBER=<n>.")
     Wait for it to finish; parse OUTCOME from its report.
     ```
   - `OUTCOME=merged`: `queue.sh pop`, then check `config.sh is-enabled clear_context` — `true`: `ScheduleWakeup(delaySeconds=60, prompt="/auto-fix-all", reason="clearing context before next issue")` and stop; `false`: loop back to the top of Step 2.
   - `OUTCOME=closed PR_NUMBER=<n>`: ask the user the same question `monitor_pr.md` asks today (reimplement vs. skip) — this is the one interactive point, now living in the coordinator. **Reimplement**: loop back to the top of Step 2 with the same id (don't pop). **Skip**: `queue.sh pop`, then loop back to the top of Step 2.
3. Delete `auto-fix-all/steps/process_next.md` and `auto-fix-all/steps/monitor_pr.md`, superseded by `process_one_issue.md`. Fold `handle_comment.md`'s content into `process_one_issue.md` unchanged (it's still needed there, just referenced from the new file instead of from `monitor_pr.md`) — or keep `handle_comment.md` as its own file and just update the one reference; either is fine, prefer keeping it separate since it's substantial and reused conceptually.

### Step 3 — Update nested cross-references

Search every skill for `Read [...](.../SKILL.md)` style references to any of the six skills and repoint them at `steps/run.md` (or `steps/process_one_issue.md` for the one case where `auto-fix-all` itself is the target, if any other skill references it — check `push-issue-to-queue` and others for this). Specifically:
- `auto-fix-all/steps/process_one_issue.md` → `../../auto-new-issue/steps/run.md`, `../../auto-plan-issue/steps/run.md`, `../../auto-fix-issue/steps/run.md`, `../../auto-monitor-issue-pr/steps/run.md`.
- `auto-monitor-issue-pr/steps/run.md` → `../../auto-monitor-pr/steps/run.md`.

Grep the whole repo for `/SKILL.md)` to make sure no other skill (e.g. `auto-monitor-issue-pr`'s own coordinator wrapper before the Step 1 split) is left pointing at a path that no longer holds the step content.

### Step 4 — Update docs

`docs/agents/architecture.md` and/or `docs/agents/flow.md` should describe this two-layer convention (coordinator `SKILL.md` delegates to `architect`; `architect` follows `steps/run.md`; nested skill-to-skill calls read `steps/run.md` directly without re-spawning) as a general pattern other skills should follow, not just a one-off for these six. Add a short section, e.g. "Architect Delegation", alongside the existing "Script Preference" section.

## Files to Change

- `auto-new-issue/SKILL.md`, `auto-new-issue/steps/run.md` (new, moved content)
- `auto-plan-issue/SKILL.md`, `auto-plan-issue/steps/run.md` (new, moved content)
- `auto-fix-issue/SKILL.md`, `auto-fix-issue/steps/run.md` (new, moved content)
- `auto-monitor-pr/SKILL.md`, `auto-monitor-pr/steps/run.md` (new, moved content)
- `auto-monitor-issue-pr/SKILL.md`, `auto-monitor-issue-pr/steps/run.md` (new, moved content)
- `auto-fix-all/SKILL.md` — rewritten as coordinator (queue, `ScheduleWakeup`, ask-user-on-close)
- `auto-fix-all/steps/process_one_issue.md` — new, merges `process_next.md` + `monitor_pr.md` minus the two coordinator-only branches
- `auto-fix-all/steps/process_next.md`, `auto-fix-all/steps/monitor_pr.md` — deleted (superseded)
- `auto-fix-all/steps/handle_comment.md` — kept, re-linked from `process_one_issue.md`
- `docs/agents/architecture.md` — document the "Architect Delegation" pattern

## Notes

- No script changes are needed — this is purely a restructuring of which markdown a real `architect` subagent reads vs. what the coordinator does inline, and where the `Agent` spawn call happens. No deterministic logic changes.
- Verify, after the refactor, that a direct standalone invocation of each of the five simple skills (e.g. a human typing `/auto-plan-issue 12` with no `auto-fix-all` in play) still works end-to-end through the new coordinator → architect → `steps/run.md` chain.
- Verify that `auto-fix-all`'s nested chain (`auto-fix-all` coordinator → architect `process_one_issue.md` → `auto-new-issue/steps/run.md` etc., all inside the *same* architect agent invocation, no further `Agent(architect)` spawning) behaves identically to today's flow for a full issue lifecycle, including the `commented`/CI-failure loops and the pre-approval (`shipit`) shortcut.
- This is a structural/process change with no automated test suite in this repo (it's all markdown) — verification is a manual dry run of each skill's flow, as called out above.
