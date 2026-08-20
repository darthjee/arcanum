# Explore the Codebase

The goal is to understand the current state of the project well enough to write a complete, actionable plan — before deciding on the agent split or writing any plan file.

## Read the architecture docs

Look for architecture or structure documentation in the project. Common locations:
- `AGENTS.md` or `CLAUDE.md` — may reference an architecture doc
- `docs/architecture.md`, `docs/agents/architecture.md`, or similar

Read whatever is available to understand the high-level folder/module breakdown of the project.

## Prefer delegating to the target repo's own agents

Before reading any code yourself, check whether the target repo has its own agents (set up via `init-claude`) to delegate to:

1. Run `scripts/list_agents.sh "$REPO_PATH"` (resolved relative to the `auto-plan-issue` skill folder) to list the repo's configured agents; the script takes `repo_path` explicitly as its first argument and resolves `.claude/agents` relative to it. Each line has the form `<name>|<description>`.
2. **No output** — the repo has no `.claude/agents/` set up. Skip to "Explore freely" below.
3. **One or more lines** — detect a coordinator agent by description, reusing [determine_agents.md](determine_agents.md)'s "Exclude the coordinator" heuristic (description mentions things like "coordinator", "coordinates other agents", "spans more than one agent's scope").
   - **Coordinator found** — delegate through it: `Agent(<coordinator-name>, ...)` with the exploration question; the coordinator decides whether to explore directly or fan out to its own specialists.
   - **No coordinator, but specialist agents exist** — match the issue's topic/paths against each specialist's documented `description` and spawn the matching specialist directly.
   - **No coordinator and no specialist agents remain** — skip to "Explore freely" below.

Use the dispatched agent's findings the same way "Explore freely" below would use your own — this only changes who does the reading, not whether confirmation is required (still none).

## Explore freely

Unlike the interactive `plan-issue` skill, this skill never waits for permission to look at code. Reached only when no repo agent handled the investigation above (no `.claude/agents/`, or no matching coordinator/specialist). Based on the issue description and the architecture docs:

1. Identify which folder(s) or module(s) are likely involved.
2. Read the relevant parts of the codebase to understand:
   - What code is affected or needs to be created
   - Existing patterns, conventions, and structure
   - Dependencies or constraints
3. If a CI config is present (e.g. `.circleci/config.yml`, `.github/workflows/*`), identify which jobs apply to the folders being touched and what local command runs them — this will populate an optional `## CI Checks` section later.

Only read what is relevant to the issue. Proceed with your best assessment of scope — no confirmation needed at any point.
