# Issue: Architect agent refuses to process issues via the auto-fix-all pipeline, citing scope/authorization concerns

## Description

`auto-fix-all` drives the full pipeline (new issue → plan → fix → monitor) for a queue of issue
IDs, one at a time, with no user interaction. When a planned issue's implementation work isn't
split across multiple specialist agents, `auto-fix-issue/steps/dispatch_agents.md` falls back to
having the `architect` agent — the one already running the pipeline — implement the plan directly,
under its own agent name. But `architect`'s own charter (`.claude/agents/architect.md`) explicitly
forbids this: it must never implement scripts itself, that is `scripter`'s job, and it must delegate
implementation to the correct specialist rather than doing it itself. When the unsplit plan actually
requires script changes (or, more generally, any change squarely inside a specialist's declared
scope), the pipeline instruction and the architect's own charter directly contradict each other, and
the run stalls instead of completing — the architect effectively refuses to continue, citing its own
scope boundaries.

This was reproduced on issue #174 ("Add skill to add issue on github"): `auto-plan-issue` produced a
single, unsplit `plan.md` whose implementation work is squarely `scripter`'s scope (writing
`arcanum/_lib/spawn_issue.sh`, editing `init-claude/scripts/lib/label_config.sh`) plus skill/doc
wording changes that belong to whoever authors skill files. Branch `issue-174` has the issue file and
plan committed, but no implementation commits and no PR — the pipeline never got past this point.

## Problem

The root cause is a lost ownership signal, not a vague safety instinct:

- `auto-plan-issue/steps/determine_agents.md` excludes the coordinator (`architect`) from its
  candidate list. When it finds that exactly **one** candidate specialist has work, it deliberately
  writes a single anonymous `plan.md` instead of a per-agent file — "there's no benefit to splitting
  when only one agent is involved." That's correct for readability, but it throws away *which*
  specialist that was.
- Downstream, `auto-fix-issue/steps/run.md` Step 3 (`list_plan_agents.sh`) can't distinguish "unsplit
  because it's genuinely cross-cutting work with no specialist owner" from "unsplit because exactly
  one specialist owns it and splitting was skipped as unnecessary" — both produce zero per-agent plan
  files. `dispatch_agents.md`'s fallback text treats every zero-file case the same way: "follow the
  same development cycle yourself... using your own agent name (architect)."
- That fallback is only valid for the first case. For the second, it directly contradicts
  `architect.md`'s own rule against personally implementing scripts (or, more generally, work that
  belongs to a defined specialist).
- The same gap exists one level up for skill-authoring work: `architect.md` currently claims
  `SKILL.md` and auxiliary `.md` files as part of its own scope, so even a single-candidate plan that
  is purely skill-wording changes has no dedicated specialist to route to either — architect ends up
  as both the coordinator and the implementer of last resort, which is exactly the role overload that
  produces this class of contradiction.
- Separately, `scripter`'s documented scope (`<skill-name>/scripts/`) doesn't cover
  `arcanum/_lib/` (shared library scripts), even though issue #174's plan — and prior merged PRs
  (#170, #166, #164, #160, #141) — already treat `arcanum/_lib/*.sh` as scripter-shaped work.

## Expected Behavior

- When `determine_agents.md` finds exactly one candidate specialist has work, that ownership is
  preserved (not collapsed into an anonymous `plan.md`) so `auto-fix-issue`'s dispatch step has a
  real signal to route on.
- `dispatch_agents.md`'s fallback only has `architect` implement a plan directly when **no**
  specialist owns any of the work — genuinely cross-cutting cases (`docs/agents/**`, root files,
  decisions spanning multiple agents). It never implements scripts or skill files itself.
- A new `skill-writer` specialist agent owns `SKILL.md` and skill auxiliary `steps/*.md` files across
  every skill, mirroring `scripter`'s narrow-scope, non-coordinator shape. `architect` no longer
  claims skill files as its own scope — it delegates to `skill-writer` the same way it already
  delegates scripts to `scripter`.
- `scripter`'s documented scope explicitly includes `arcanum/_lib/`, alongside `<skill-name>/scripts/`.
- `.claude/agents/architect.md`, `.claude/agents/scripter.md`, `.claude/agents/skill-reviewer.md`,
  `AGENTS.md`, and `docs/agents/folder-structure.md` are written in English, like the rest of the
  project's documentation. The new `skill-writer.md` is authored in English from the start.

## Solution

1. **Fix the ownership-recording gap** in `auto-plan-issue/steps/determine_agents.md`'s "exactly one
   candidate agent has work" branch: still record which agent that is (e.g. write it as
   `<agent>.md` under the plan dir instead of an anonymous `plan.md`, or add an explicit owner
   marker `determine_agents.md`/`list_plan_agents.sh` can agree on).
2. **Fix the dispatch fallback** in `auto-fix-issue/steps/run.md` (Step 3's "no output" branch) and
   `dispatch_agents.md`: check for the recorded single owner from (1) before defaulting to "architect
   implements it directly." Only fall through to architect when genuinely no owner is recorded.
3. **Add `.claude/agents/skill-writer.md`** — new specialist agent. Scope: `SKILL.md` and
   `<skill-name>/steps/*.md` for any skill. Tools: `Read, Edit, Write, Bash` (leaf specialist, same
   shape as `scripter` — no `Agent` tool, it doesn't coordinate anyone). Update `architect.md` to
   drop "SKILL.md and auxiliary .md files" from its own scope and delegate that to `skill-writer`
   instead, keeping `docs/agents/**`, root files, and cross-agent decisions as architect's own scope.
4. **Update `scripter.md`'s scope line** to cover `arcanum/_lib/` alongside `<skill-name>/scripts/`.
5. **Update the roster docs**: `AGENTS.md`'s Agent table and
   `docs/agents/architecture/agent-roster-and-delegation.md`'s Agent Roster table both get a
   `skill-writer` row, and `architect`'s/`scripter`'s described scope is adjusted to match points 3–4.
   `determine_agents.md` already lists every agent under `.claude/agents/` and excludes only the
   coordinator, so `skill-writer` is automatically picked up as a candidate — no script change needed
   there beyond confirming its "has work" judgment isn't hardcoded to script-shaped changes only.
6. **Translate to English**: `.claude/agents/architect.md`, `.claude/agents/scripter.md`,
   `.claude/agents/skill-reviewer.md`, `AGENTS.md`, and `docs/agents/folder-structure.md` — content
   translation only, no behavioral change beyond points 3–5 above, which land in the same files
   anyway.
7. Since `skill-writer` doesn't exist until this issue lands, `architect` necessarily authors
   `skill-writer.md` itself and applies the translations directly as a one-time bootstrap — the same
   way it originally authored `scripter.md`/`skill-reviewer.md` — rather than delegating to an agent
   that doesn't exist yet.

## Benefits

- Directly fixes the reproduced stall from issue #174: a single-owner plan now routes to the correct
  specialist instead of asking `architect` to violate its own charter.
- Closes the gap generally, not just for scripts: `skill-writer` removes the other half of the
  ambiguity, so `architect` never ends up personally authoring skill files during an autonomous
  single-candidate run either.
- `scripter`'s documented scope finally matches how it's actually been used (`arcanum/_lib/`
  changes already shipped in #170, #166, #164, #160, #141).
- Whole-repo consistency: every agent/doc file is in English, matching the rest of the project and
  removing a source of friction for contributors and agents that don't read Portuguese.
