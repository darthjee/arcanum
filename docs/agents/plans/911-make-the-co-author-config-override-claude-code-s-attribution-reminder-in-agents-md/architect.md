# Architect Plan: Make the co-author config override Claude Code's attribution reminder in AGENTS.md

Main plan: [plan.md](plan.md)

## Shared contracts

Use the exact policy line and `## Commit Attribution` block from [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — arcanum's own AGENTS.md

Append the `## Commit Attribution` block to this repo's `AGENTS.md`. Running the new shim against the repo does this directly once it exists.

### Step 2 — Docs

- In `docs/guides/arcanum-repo-config.md`, next to `git.omit_model_coauthor` / `git.remove_coauthors`, note that init-claude (and migration `next/004`) adds an AGENTS.md line, so hand-written commits follow these keys over Claude Code's attribution reminder.
- Mention the new init-claude step wherever init-claude's steps are documented (e.g. `README.md`, if it lists them).

## Files to Change

- `AGENTS.md` — add the block.
- `docs/guides/arcanum-repo-config.md` — mention the AGENTS.md line.

## Notes

- PR body attribution is out of scope (decided in the issue).
