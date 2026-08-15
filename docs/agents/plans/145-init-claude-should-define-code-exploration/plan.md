# Plan: init-claude should define code exploration

Issue: [145-init-claude-should-define-code-exploration.md](../../issues/145-init-claude-should-define-code-exploration.md)

## Overview

Teach arcanum's skills to delegate code exploration (and, where relevant, planning) to a target repo's own `.claude/agents/` — set up via `init-claude` — instead of exploring inline or reaching for a generic `Explore` agent. This touches `init-claude`'s `architect` template, the exploration steps of `discuss-issue`/`plan-issue`/`auto-plan-issue`, and a new per-repo migration that retrofits existing repos' `architect.md`. A small piece of shared script logic (agent listing) gets canonicalized so all three consuming skills can reuse the same coordinator-detection approach `auto-plan-issue` already has.

Only one specialist agent (`scripter`) has clearly scoped work in this repo's own agent roster (`skill-reviewer` is a read-only, post-hoc reviewer with nothing to implement here), so this plan stays a single file rather than splitting — per `determine_agents.md`'s "exactly one candidate has work" rule, scripter's script step is called out explicitly below and should be delegated to it.

## Context

See the issue file for full background. Key points carried into this plan:
- Problem: `discuss-issue` spawns only generic exploration agents; `plan-issue`/`auto-plan-issue` explore inline; none of them prefer a target repo's own `init-claude`-defined agents.
- Routing rule (priority order): coordinator agent (detected by description, not a hardcoded `architect.md` filename) → matching specialist by scope → generic `Explore`/inline fallback.
- `init-claude`'s `architect` template gains explicit delegation-to-exploration/planning language, mirroring its existing implementation-delegation language.
- Existing repos get retrofitted via a `repo`-scoped, skippable, `instructions`-type migration touching only `.claude/agents/architect.md`.
- `enhance-issue` is explicitly out of scope.

## Implementation Steps

### Step 1 — Canonicalize agent listing (delegate to `scripter`)
`auto-plan-issue/scripts/list_agents.sh` currently contains the full listing logic (reads `.claude/agents/*.md` frontmatter, prints `<name>|<description>` lines) and lives only under that one skill. `discuss-issue` and `plan-issue` need the same capability to build their routing rule. Following this repo's existing thin-wrapper-over-canonical pattern (see `auto-plan-issue/scripts/resolve_plan_paths.sh` → `arcanum/_lib/resolve_plan_paths.sh`):
1. Move the logic into `arcanum/_lib/list_agents.sh` unchanged (same usage/output contract: `list_agents.sh [agents_dir]`, `<name>|<description>` lines, defaults to `.claude/agents`).
2. Turn `auto-plan-issue/scripts/list_agents.sh` into a thin wrapper delegating to it (`exec "${SCRIPT_DIR}/../../arcanum/_lib/list_agents.sh" "$@"`).
3. Add matching thin wrappers `discuss-issue/scripts/list_agents.sh` and `plan-issue/scripts/list_agents.sh`.

### Step 2 — Update `init-claude`'s architect template
In `init-claude/setup_agents.md`'s Step 4 draft:
1. **"Specialist agents" section** — broaden the delegation line to: "Delegate implementation, exploration, and planning work to the right agent. Never implement, explore, or plan what belongs to a specialist yourself."
2. **"How to coordinate" section** — insert a new step (before "Integrate"): "**Delegate exploration first** — before proposing an approach, dispatch the specialist(s) whose scope covers the relevant area to investigate, rather than reading the code yourself."

### Step 3 — Add the routing rule to `discuss-issue`
In `discuss-issue/steps/discuss_and_save.md`'s "Spawn specialist agents as needed" section, insert the routing rule ahead of the current generic-`Explore`-agent guidance:
1. Run `list_agents.sh` (Step 1's wrapper) against the target repo (`.claude/agents`, resolved under `$REPO_PATH`).
2. Detect a coordinator by description (reuse `auto-plan-issue/steps/determine_agents.md`'s existing heuristic: keywords like "coordinator", "coordinates other agents", "spans more than one agent's scope").
3. If a coordinator is found, delegate through it (`Agent(<coordinator-name>, ...)`) with the exploration question.
4. Else, if specialist agents exist but no coordinator, match the issue's topic/paths against each specialist's documented scope and spawn the matching one directly.
5. Else, fall back to today's behavior (generic `Explore` agent).

### Step 4 — Add the routing rule to `plan-issue`
Same routing rule, added to `plan-issue/steps/write_and_confirm.md`'s "Analyzing the codebase" section, ahead of its current inline-exploration instructions ("Explore the relevant parts of the project folder..."). Fallback here is inline exploration (today's behavior), not a generic `Explore` agent.

### Step 5 — Add the routing rule to `auto-plan-issue`
Same routing rule, added to `auto-plan-issue/steps/explore_codebase.md`, ahead of its "Explore freely" section. The "without asking permission" characteristic is preserved — this only changes who does the reading, not whether confirmation is required. Fallback is inline exploration, same as today.

### Step 6 — Author the migration
1. Run `arcanum/migrations/generate_next.sh --type instructions` to scaffold the next id's `<id>.md`/`<id>.instructions.md` in `arcanum/migrations/repos/next/` and append the manifest entry.
2. Edit the appended `migrations.json` entry's defaults: `skippable: true` (already the scaffolded default, keep it), `applies_to: "repo"` (change from the scaffolded `"local"` default — `.claude/agents/architect.md` is committed/shared team-wide, not per-clone state).
3. Write `<id>.md` (human-facing): "Retrofit `.claude/agents/architect.md` (if present) to delegate exploration and planning to the right specialist agent, not just implementation."
4. Write `<id>.instructions.md` (AI-facing):
   - Check whether `.claude/agents/architect.md` exists; if absent, mark complete with no changes.
   - In "Specialist agents", extend the delegation line (same wording as Step 2), adapting to the file's actual current phrasing if customized.
   - In "How to coordinate", insert the same new step as Step 2, adapting to existing numbering/wording.
   - If either section is missing or heavily restructured, ask the user where the equivalent guidance should go rather than guessing.
   - Save the file.

## Files to Change
- `arcanum/_lib/list_agents.sh` — new canonical script (moved from `auto-plan-issue/scripts/`).
- `auto-plan-issue/scripts/list_agents.sh` — converted to thin wrapper.
- `discuss-issue/scripts/list_agents.sh` — new thin wrapper.
- `plan-issue/scripts/list_agents.sh` — new thin wrapper.
- `init-claude/setup_agents.md` — architect template's two delegation additions.
- `discuss-issue/steps/discuss_and_save.md` — routing rule in "Spawn specialist agents as needed".
- `plan-issue/steps/write_and_confirm.md` — routing rule in "Analyzing the codebase".
- `auto-plan-issue/steps/explore_codebase.md` — routing rule before "Explore freely".
- `arcanum/migrations/repos/next/migrations.json` — new `instructions`-type entry.
- `arcanum/migrations/repos/next/<id>.md` and `<id>.instructions.md` — new migration content (exact `<id>` determined at implementation time by `generate_next.sh`).

## Notes
- Delegate Step 1 (script work) to the `scripter` agent per this repo's standing convention — do not write/move the script inline in `SKILL.md`/step files.
- After implementation, dispatch `skill-reviewer` to review the changed step files (`discuss_and_save.md`, `write_and_confirm.md`, `explore_codebase.md`, `setup_agents.md`) for any complex inline bash that should have been extracted — it is read-only and reports findings back to the architect rather than fixing them.
- Manual verification (no automated test suite for skill prose exists): (1) run `init-claude` on a fresh test repo and confirm `architect.md` contains the new delegation language; (2) run the new migration against a repo with a pre-existing `architect.md` and confirm it's retrofitted correctly, preserving customizations.
- No CI job applies to this change — this repo's only CircleCI job (`build-and-release`) runs solely on version-tag pushes, not on branches/PRs.
