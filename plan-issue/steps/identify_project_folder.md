# Identify Project Folder

The goal is to know which folder(s) or module(s) of the project this issue touches, before writing any plan.

## Read the architecture docs

Look for architecture or structure documentation in the project. Common locations:
- `AGENTS.md` or `CLAUDE.md` — may reference an architecture doc
- `docs/architecture.md`, `docs/agents/architecture.md`, or similar

Read whatever is available to understand the high-level folder/module breakdown of the project.

## Determine the relevant folder(s)

Based on the issue description and the architecture docs, identify which folder(s) or module(s) are likely involved.

- If it is **obvious** from the issue title and description (e.g., "fix the API endpoint for users" clearly maps to a `api/` or `backend/` module), make a confident suggestion.
- If it is **ambiguous** or the project has many modules, list the candidates.

## Ask the user to confirm

Present your understanding and ask the user to confirm or correct it. Say exactly:

```
Based on the issue and the project architecture, this seems to involve: <folder(s)/module(s)>.
Is that correct, or should we focus on a different part of the project?
```

Wait for the user's response. Update your understanding based on their answer before proceeding.
