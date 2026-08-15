# Issue: init-claude should define code exploration

## Description

Arcanum skills that need to explore a target repo's codebase (`discuss-issue`, `plan-issue`) should delegate that exploration to the repo's own agents (set up via `init-claude`) instead of exploring inline or reaching for a generic `Explore` agent — and `init-claude`'s `architect` template should teach new agent structures to do the same for exploration and planning, not just implementation.

## Problem

When running arcanum skills (`discuss-issue`, `plan-issue`, and similar) against a target repo that already has its own `.claude/agents/` set up via `init-claude` (an `architect` coordinator plus specialist agents scoped to parts of the codebase), those skills don't hand exploration off to that repo's own agents:

- `discuss-issue` does spawn agents for exploration, but only generic ones (an `Explore` agent, or "a domain-specific agent if the project defines one") — it never specifically prefers the target repo's own `architect`/specialist agents, which carry the repo's actual conventions and scope knowledge.
- `plan-issue` explores the codebase inline itself ("Explore the relevant parts of the project folder...") with no mention of delegating to repo agents at all.
- `enhance-issue` deliberately keeps its exploration step inline and lightweight by design — that's an intentional scoping choice, not a bug, and is out of scope here.

The result: even in repos that have gone through `init-claude` and defined a proper agent structure, arcanum skills mostly bypass it and explore the codebase themselves (or via a generic agent) instead of delegating to the repo's purpose-built agents.

## Expected Behavior

When a target repo has `.claude/agents/` set up (via `init-claude`):

1. `discuss-issue`/`plan-issue`/`auto-plan-issue` prefer delegating exploration to that repo's own coordinator/specialist agents over a generic `Explore` agent or inline reading.
2. `init-claude`'s `architect` template already instructs new architects to delegate exploration and planning, the same way it already instructs delegating implementation — so this is the default for every repo set up after the change ships.
3. Repos that already ran `init-claude` before this change get their `.claude/agents/architect.md` retrofitted via a migration, so the same delegation behavior applies without re-running `init-claude` from scratch.

Repos without any `.claude/agents/` keep behaving exactly as they do today (generic `Explore` agent / inline exploration) — this issue only changes behavior where a repo-specific agent structure actually exists to delegate to.

## Solution

Code exploration (and, where relevant, parts of planning) should be distributed to the target repo's own agents when it has them, not just execution.

### init-claude
`setup_agents.md`'s `architect` template (Step 4 draft) changes in two spots:

1. **"Specialist agents" section** — broaden the existing delegation line:
   > Delegate implementation, exploration, and planning work to the right agent. Never implement, explore, or plan what belongs to a specialist yourself.
2. **"How to coordinate" section** — insert a new step calling out exploration specifically (easy to skip past when skimming for implementation tasks only):
   > **Delegate exploration first** — before proposing an approach, dispatch the specialist(s) whose scope covers the relevant area to investigate, rather than reading the code yourself.

### discuss-issue / plan-issue
These skills' own exploration steps also learn to reach for the target repo's agents (defined via `init-claude`) instead of defaulting to inline reading or a generic `Explore` agent:

**Routing rule**, in priority order:
1. Identify the coordinator agent, if any, by reusing `auto-plan-issue/steps/determine_agents.md`'s existing description-based heuristic (scan `.claude/agents/*.md` descriptions for coordinator-like language — "coordinator", "coordinates other agents", "spans more than one agent's scope", etc.) instead of hardcoding the filename `architect.md`. `setup_agents.md` only says the coordinator is "conventionally named `architect`", not guaranteed, and this repo already has one working solution to this exact detection problem — reuse it rather than inventing a second, filename-based one.
2. If a coordinator agent is found, always delegate through it — spawn `Agent(<coordinator-name>, ...)` with the exploration question; the coordinator (which already knows its specialists' scopes) decides whether to explore directly or fan out to specialists.
3. Else, if the repo has specialist agents but no coordinator, the skill matches the issue's topic/paths against each specialist's documented scope (from `.claude/agents/*.md`) and spawns the matching specialist directly.
4. Else (no `.claude/agents/` at all), fall back to today's behavior: a generic `Explore` agent (`discuss-issue`) or inline exploration (`plan-issue`/`auto-plan-issue`).

Affected step files:
- `discuss-issue/steps/discuss_and_save.md` — "Spawn specialist agents as needed" section gains this routing rule ahead of its current generic-`Explore`-agent guidance.
- `plan-issue/steps/write_and_confirm.md` — "Analyzing the codebase" section gains the same routing rule ahead of its current inline-exploration instructions.
- `auto-plan-issue/steps/explore_codebase.md` — also gains this routing rule, applied before its "Explore freely" instructions; the "without asking permission" characteristic is unaffected, this only changes who does the reading.
- `enhance-issue` is explicitly out of scope — its exploration step stays inline/lightweight by design.

### Testing / verification
No automated test suite exists for skill prose, so this ships with a manual verification pass:
1. Run `init-claude` on a fresh test repo and confirm the generated `architect.md` contains the new delegation language (both the broadened "Specialist agents" line and the new "How to coordinate" step).
2. Run the migration against a repo with a pre-existing `architect.md` and confirm it's retrofitted correctly, preserving the file's existing customizations.
3. Dispatch the `skill-reviewer` agent (per this repo's standing convention) to review the changed step files (`discuss_and_save.md`, `write_and_confirm.md`, `explore_codebase.md`, `setup_agents.md`) once implemented.

### migration
**Scope: new vs. existing repos**
- New repos (or repos running `init-claude` for the first time after this change ships): get the updated `architect` template for free — `setup_agents.md` is already updated, nothing extra needed.
- Existing repos that already ran `init-claude` and have `.claude/agents/architect.md`: need that one file retrofitted with the two new instruction snippets (the "Specialist agents" delegation line + the "How to coordinate" step). Specialist agent files are untouched — the change never touched their template.
- Repos with no `.claude/agents/` at all (never ran `init-claude`): nothing to migrate — the discuss-issue/plan-issue routing rule already falls back gracefully to today's behavior.

So the migration's blast radius is exactly one file per repo: `.claude/agents/architect.md`, when present.

**Migration shape**

Manifest entry (in `arcanum/migrations/repos/next/migrations.json`, added via `generate_next.sh --type instructions`):
- `type: "instructions"` — `architect.md` content varies per repo (custom specialist tables, possibly reworded delegation lines), so a deterministic script (sed-style replace) is too risky; an AI needs to read the file and merge the change coherently.
- `skippable: true` — not a breaking change; a repo that skips it keeps working exactly as before, it just misses out on the improved delegation behavior.
- `applies_to: "repo"` — `.claude/agents/architect.md` is committed and shared team-wide (it's what `init-claude` writes for everyone), so one person running the migration and committing it satisfies it for the whole team, same as any other codebase change — not per-clone local state.

Draft content:
- `<id>.md` (human-facing description shown at the confirm prompt): "Retrofit `.claude/agents/architect.md` (if present) to delegate exploration and planning to the right specialist agent, not just implementation."
- `<id>.instructions.md` (AI-facing, performed on `[R]un`):
  1. Check whether `.claude/agents/architect.md` exists in the target repo. If absent, there's nothing to do — mark the entry complete without changes.
  2. In the "Specialist agents" section, find the delegation line (originally "Delegate implementation work to the right agent. Never implement what belongs to a specialist yourself.") and extend it to also cover exploration and planning, adapting to the file's actual current wording if it's been customized rather than overwriting wholesale.
  3. In the "How to coordinate" section, insert an additional step (before "Integrate"): "Delegate exploration first — before proposing an approach, dispatch the specialist(s) whose scope covers the relevant area to investigate, rather than reading the code yourself." — again adapting to the section's existing numbering/wording.
  4. If either section is missing or has been restructured beyond recognition, ask the user where the equivalent guidance should go rather than guessing.
  5. Save the file.

## Benefits

- Plans and issue refinements grounded in the target repo's actual conventions and scope knowledge, not a generic read of the code.
- `init-claude`'s agent structure becomes genuinely load-bearing for the whole arcanum pipeline (exploration + planning + implementation), not just implementation.
- No behavior change for repos that haven't adopted `init-claude` — the routing rule degrades gracefully to today's behavior.
- Existing `init-claude` repos catch up automatically via the standard migration flow, without re-running `init-claude` from scratch.
