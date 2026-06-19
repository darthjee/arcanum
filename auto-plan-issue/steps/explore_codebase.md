# Explore the Codebase

The goal is to understand the current state of the project well enough to write a complete, actionable plan — before deciding on the agent split or writing any plan file.

## Read the architecture docs

Look for architecture or structure documentation in the project. Common locations:
- `AGENTS.md` or `CLAUDE.md` — may reference an architecture doc
- `docs/architecture.md`, `docs/agents/architecture.md`, or similar

Read whatever is available to understand the high-level folder/module breakdown of the project.

## Explore freely

Unlike the interactive `plan-issue` skill, this skill never waits for permission to look at code. Based on the issue description and the architecture docs:

1. Identify which folder(s) or module(s) are likely involved.
2. Read the relevant parts of the codebase to understand:
   - What code is affected or needs to be created
   - Existing patterns, conventions, and structure
   - Dependencies or constraints
3. If a CI config is present (e.g. `.circleci/config.yml`, `.github/workflows/*`), identify which jobs apply to the folders being touched and what local command runs them — this will populate an optional `## CI Checks` section later.

Only read what is relevant to the issue. Proceed with your best assessment of scope — no confirmation needed at any point.
