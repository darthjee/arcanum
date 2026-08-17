# Plan: Architect agent refuses to process issues via the auto-fix-all pipeline, citing scope/authorization concerns

Issue: [182-architect-agent-refuses-to-process-issues-via-the-auto-fix-all-pipeline--citing-scope-authorization-concerns.md](../../issues/182-architect-agent-refuses-to-process-issues-via-the-auto-fix-all-pipeline--citing-scope-authorization-concerns.md)

## Overview

Fix the ownership-recording gap in `auto-plan-issue`/`auto-fix-issue` that lets a single-specialist
unsplit plan silently fall back to "architect implements it directly" — the exact contradiction that
stalled issue #174 (architect's own charter forbids it from implementing scripts itself). Close the
same class of gap one level up by introducing a new `skill-writer` specialist that owns `SKILL.md`/
`steps/*.md` files, so `architect` is never the implementer of last resort for skill-authoring work
either. Correct `scripter`'s documented scope to include `arcanum/_lib/`. Translate the remaining
Portuguese-language project files to English.

## Context

`auto-fix-issue/steps/run.md` Step 3 lists per-agent plan files via `list_plan_agents.sh`; when none
exist, `dispatch_agents.md`'s fallback has `architect` implement the whole plan itself. That fallback
is only safe when the plan is genuinely cross-cutting with no specialist owner. But
`auto-plan-issue/steps/determine_agents.md`'s "exactly one candidate has work" branch also produces
zero per-agent files (by design, to avoid a pointless single-file split) — indistinguishable
downstream from the true no-owner case. On issue #174, the sole candidate (`scripter`, for
`arcanum/_lib/spawn_issue.sh`) was lost this way, `architect` was told to implement it, and its own
"never implement a script yourself" rule stalled the run. See the issue file for the full trace.

This plan is itself entirely `architect`-scoped work: every change below is either a skill step
`.md` file (until `skill-writer` exists, still architect's own responsibility — this issue is what
creates that agent), an agent-definition file under `.claude/agents/` (bootstrap-authored by
architect, same as `scripter.md`/`skill-reviewer.md` originally were), or `docs/agents/**`/root
files. No `<skill-name>/scripts/` or `arcanum/_lib/` bash script needs to change, so `scripter` has
no work here, and `skill-reviewer` never implements (read-only). Per `determine_agents.md`'s own
rule, when no candidate specialist has work, the plan stays unsplit and architect handles it
directly — which is exactly what this plan does.

## Implementation Steps

### Step 1 — Fix the ownership-recording gap in `determine_agents.md`

In `auto-plan-issue/steps/determine_agents.md`'s "Decide which candidate agents have work" section,
change the "exactly one candidate agent has work" branch: instead of writing that agent's plan as
the anonymous single `plan.md`, still set `AGENT_SPLIT=false` (no `## Agents involved`/
`## Shared contracts` sections needed — there's nothing to share with zero other involved agents),
but write the plan content into `<agent-name>.md` under `PLAN_DIR`, and write a minimal `plan.md`
that just points to it (mirrors the overview/index shape from Case B, without the "Shared contracts"
section since there's only one agent). This preserves the owner's name on disk without paying the
overhead of a full multi-agent split.

Cross-reference `write_plan.md`'s "Case A" section (used today for both the true-no-owner case and
the single-owner case) — it needs a note distinguishing the two: true no-owner unsplit plans keep
today's plain `plan.md` shape; single-owner unsplit plans use the new `<agent-name>.md` + pointer
`plan.md` shape described above.

### Step 2 — Fix the dispatch fallback in `auto-fix-issue`

In `auto-fix-issue/steps/run.md` Step 3 and `auto-fix-issue/steps/dispatch_agents.md`: `list_plan_agents.sh`
already scans `PLAN_DIR` for `<agent-name>.md` files, so after Step 1 above, a single-owner plan is
no longer indistinguishable from a true no-owner plan — `list_plan_agents.sh` now finds the one
`<agent-name>.md` file and Step 3's existing "one or more lines" branch (dispatch to that agent)
already handles it correctly. Update `dispatch_agents.md`'s fallback text (used only when
`list_plan_agents.sh` prints nothing at all) to make explicit that this path is reached only for
genuinely unowned, cross-cutting work — never for work that belongs to a specific specialist — since
that's now guaranteed structurally by Step 1's change rather than left to interpretation.

### Step 3 — Add the `skill-writer` specialist agent

Create `.claude/agents/skill-writer.md`, modeled on `.claude/agents/scripter.md`'s shape and tone
(English, since this is a new file):

- `name: skill-writer`
- `description`: mentions writing/editing `SKILL.md` and auxiliary `steps/*.md` files for any skill
  — the counterpart to `skill-reviewer`'s review-only role.
- `tools: Read, Edit, Write, Bash` — leaf specialist, no `Agent` tool (it doesn't coordinate anyone),
  same shape as `scripter`.
- Scope section: every `<skill-name>/SKILL.md` and `<skill-name>/steps/*.md` (or equivalent
  auxiliary `.md` files referenced from `SKILL.md`) of any skill folder at the project root.
  Explicitly excludes `docs/agents/**`, root-level files (`AGENTS.md`, `README.md`, `CLAUDE.md`),
  and `.claude/agents/*.md` — those stay with `architect`.
- Coordination section: before creating/changing a script call a skill file makes, align the
  call signature with `scripter` first (mirrors `scripter.md`'s existing "Como coordenar com o
  architect" section, adapted to describe the reverse relationship).

Update `.claude/agents/architect.md`'s own scope section: remove "Todo SKILL.md e arquivo .md
auxiliar de qualquer skill" and replace it with a line delegating skill files to `skill-writer`,
the same way it already delegates scripts to `scripter`. Add `skill-writer` to architect's
"Agentes especialistas" table. Keep `docs/agents/**`, root-level files, and cross-agent decisions as
architect's own scope, unchanged. (This edit lands as part of Step 6's translation pass, in English.)

### Step 4 — Correct `scripter`'s documented scope

Update `.claude/agents/scripter.md`'s scope section to cover `arcanum/_lib/` alongside
`<skill-name>/scripts/`, reflecting how it has already been used in practice (PRs #170, #166, #164,
#160, #141 all touched `arcanum/_lib/*.sh`). (Lands as part of Step 6's translation pass.)

### Step 5 — Update roster docs

- `AGENTS.md`'s `## Agents` table: add a `skill-writer` row, and adjust `architect`'s/`scripter`'s
  described scope to match Steps 3–4.
- `docs/agents/architecture/agent-roster-and-delegation.md`'s "Agent Roster" table: add a
  `skill-writer` row (scope + "when the architect dispatches it"), and update the "Architect
  Delegation" section to describe the corrected single-owner routing from Steps 1–2 — explicitly
  noting that "no specialist owns any of the work" (not "no per-agent file exists") is the actual
  condition for architect implementing a pipeline step directly.

No change needed to `auto-plan-issue/steps/determine_agents.md`'s agent-listing/coordinator-exclusion
logic itself — it already lists every agent under `.claude/agents/` via `list_agents.sh` and excludes
only the detected coordinator, so `skill-writer` is automatically picked up as a candidate once
Step 3 lands. Confirm its "Decide which candidate agents have work" judgment prose isn't written in
a way that assumes only script-shaped changes (it currently just says "judge... whether this issue
requires changes within that agent's scope," which already generalizes fine).

### Step 6 — Translate Portuguese files to English

Translate content only (no behavioral/structural change beyond what Steps 3–5 already specify,
which land in the same files) for:

- `.claude/agents/architect.md`
- `.claude/agents/scripter.md`
- `.claude/agents/skill-reviewer.md`
- `AGENTS.md`
- `docs/agents/folder-structure.md`

`.claude/agents/skill-writer.md` (Step 3) is authored in English directly — no translation needed.

## Files to Change

- `auto-plan-issue/steps/determine_agents.md` — record the single-owner's name via `<agent-name>.md` instead of an anonymous `plan.md`.
- `auto-plan-issue/steps/write_plan.md` — document the two Case A shapes (true no-owner vs. single-owner).
- `auto-fix-issue/steps/dispatch_agents.md` — clarify the architect-implements-directly fallback now only fires for genuinely unowned work.
- `.claude/agents/skill-writer.md` (new) — the new specialist agent.
- `.claude/agents/architect.md` — drop skill-file scope, delegate to `skill-writer`; translate to English.
- `.claude/agents/scripter.md` — add `arcanum/_lib/` to scope; translate to English.
- `.claude/agents/skill-reviewer.md` — translate to English.
- `AGENTS.md` — add `skill-writer` row, adjust `architect`/`scripter` scope descriptions; translate to English.
- `docs/agents/architecture/agent-roster-and-delegation.md` — add `skill-writer` row, correct the single-owner routing description.
- `docs/agents/folder-structure.md` — translate to English.

## Notes

- This plan is intentionally unsplit (`AGENT_SPLIT=false`): neither `scripter` (no `<skill-name>/scripts/`
  or `arcanum/_lib/` script changes) nor `skill-reviewer` (read-only, never implements) has work here,
  and `skill-writer` doesn't exist yet — it's what Step 3 creates. Architect implements this plan
  directly, consistent with the very rule this issue establishes.
- Step 1's `<agent-name>.md` + pointer `plan.md` shape for the single-owner case is a judgment call
  on the cleanest way to preserve ownership without the overhead of a full `## Shared contracts`
  section; if a simpler mechanism (e.g. a plain `## Owner: <agent-name>` line inside the existing
  anonymous `plan.md`) turns out easier to implement correctly in `list_plan_agents.sh`, prefer that
  instead — the important part is that `list_plan_agents.sh` can recover the owner's name
  unambiguously, not the specific file shape.
- `list_plan_agents.sh` itself is a script under `auto-fix-issue/scripts/` — if Step 1's chosen
  mechanism requires changing its parsing logic (rather than just changing what `determine_agents.md`
  writes to disk), that specific script edit is `scripter`'s scope, not architect's; re-run the
  candidate-agent judgment for this plan if that turns out to be necessary.
