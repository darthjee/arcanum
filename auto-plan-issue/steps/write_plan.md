# Write the Plan File(s)

Write all plan content in English, regardless of the language used in the issue. Save everything inside `PLAN_DIR` (resolved in Step 1). Never ask for confirmation — this skill is fully autonomous.

## Case A — AGENT_SPLIT=false

Write a single `plan.md`:

```markdown
# Plan: <Issue Title>

Issue: [<id>_<slug>.md](../issues/<id>_<slug>.md)

## Overview
<Brief description of what this plan covers>

## Context
<Relevant background from the issue description>

## Implementation Steps

### Step 1 — <Name>
<Description of what to do and why>

### Step 2 — <Name>
<Description of what to do and why>

...

## Files to Change
- `path/to/file.ext` — <what changes and why>

## CI Checks
<Only if a CI config was found in Step 2. Otherwise omit this section entirely.>
- `<folder>`: `<local command>` (CI job: `<job name>`)

## Notes
- <Any caveats, risks, open questions, or unknowns>
```

If the plan is genuinely large, you may split it into multiple files inside `PLAN_DIR` (e.g. `plan.md`, `plan_api.md`) with `plan.md` acting as the index — same judgment call as in `plan-issue`. This is independent of the agent split in Case B.

## Case B — AGENT_SPLIT=true

Write one file per involved agent, named `<agent-name>.md` (the same `name` reported by `list_agents.sh`), plus an overview `plan.md`.

### `plan.md` — overview/index

```markdown
# Plan: <Issue Title>

Issue: [<id>_<slug>.md](../issues/<id>_<slug>.md)

## Overview
<approach: what will be built and why, in 2-4 sentences>

## Agents involved

- [<agent-name>](<agent-name>.md)
- [<agent-name>](<agent-name>.md)
<one line per involved agent, in the order they have work, omit agents with no work>

## Shared contracts

<The contracts identified in Step 3 — be precise: field names, types, nullable flags, example values, or whatever interface crosses the boundary between these specific agents.>
```

### `<agent-name>.md` — one per involved agent

```markdown
# <Agent Name> Plan: <Issue Title>

Main plan: [plan.md](plan.md)

## Shared contracts

<copy only the part of Step 3's contracts relevant to this agent — what it must
produce and/or what it can rely on other agents producing.>

## Implementation Steps

### Step 1 — <Name>
<Description of what to do and why, scoped to this agent>

...

## Files to Change
- `path/to/file.ext` — <what changes and why>

## CI Checks
<Only if applicable to this agent's files. Otherwise omit.>
- `<folder>`: `<local command>` (CI job: `<job name>`)

## Notes
- <Any caveats, risks, open questions, or unknowns scoped to this agent>
```

## After writing

The files are complete once saved to disk under `PLAN_DIR`. Do not present an overview or ask "Does this approach look correct?" — proceed directly to Step 5 (commit) in the SKILL.md.
