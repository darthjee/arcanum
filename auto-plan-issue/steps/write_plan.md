# Write the Plan File(s)

Write all plan content in English, regardless of the language used in the issue. Save everything inside `PLAN_DIR` (resolved in Step 1). Never ask for confirmation — this skill is fully autonomous.

## Splitting into step files (applies to every case below)

**Step file naming**: `<agent-name>/<NN>-<slug>.md` — a two-digit zero-padded step number plus a short descriptive slug (e.g. `backend/01-add-users-endpoint.md`). Case A1 (no owner) uses `plan/<NN>-<slug>.md` instead, rooted at `plan.md` in the same way.

**Split threshold**: after drafting an agent's (or, for Case A1, the whole plan's) steps, count them.
- **1–2 steps**: keep them inline under `## Implementation Steps` in the single file — no subfolder, no separate step files. This is today's shape, unchanged.
- **3 or more steps**: move the steps out into per-step files, and turn the file that would have held them into an index instead. See "Index and step-file shape" below.

### Index and step-file shape (only when the >2-steps threshold applies)

The index file (`plan.md` for Case A1, `<agent-name>.md` for Case A2/B) keeps everything it normally has (`Main plan:` link where applicable, `## Shared contracts` for Case B) but replaces `## Implementation Steps` with `## Steps`: an ordered list of links, one per step, in execution order:

```markdown
## Steps

- [01 — Add endpoint](<agent-name>/01-add-endpoint.md)
- [02 — Add validation](<agent-name>/02-add-validation.md)
```

(For Case A1, links point at `plan/01-add-endpoint.md` etc. instead.)

`## CI Checks` and `## Notes` stay in the index, scoped to the whole plan/agent — not duplicated per step.

Each step file, `<agent-name>/<NN>-<slug>.md` (or `plan/<NN>-<slug>.md` for Case A1), is self-contained:

```markdown
# <Name>
<Description of what to do and why>

## Files to Change
- `path/to/file.ext` — <what changes and why>
```

No `### Step N` heading inside the step file — the filename and the index link already convey the ordering and name, so the file's main content starts directly at a top-level `# <Name>` heading. `## Files to Change` here is scoped only to that specific step: pull the subset of the agent's (or plan's) overall file list relevant to this step, not the full list.

## Case A — AGENT_SPLIT=false

`AGENT_SPLIT=false` covers two distinct scenarios from `determine_agents.md`'s "Decide which candidate agents have work" section, and they produce different file shapes:

### Case A1 — no owner (genuinely cross-cutting)

None of the candidate agents have work, or no agents are configured at all. Write a single `plan.md` when it has 2 or fewer steps:

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

## Files to Change
- `path/to/file.ext` — <what changes and why>

## CI Checks
<Only if a CI config was found in Step 2. Otherwise omit this section entirely.>
- `<folder>`: `<local command>` (CI job: `<job name>`)

## Notes
- <Any caveats, risks, open questions, or unknowns>
```

When it has more than 2 steps, apply the "Splitting into step files" rules above, rooted at `plan.md` and `plan/<NN>-<slug>.md`:

```markdown
# Plan: <Issue Title>

Issue: [<id>_<slug>.md](../issues/<id>_<slug>.md)

## Overview
<Brief description of what this plan covers>

## Context
<Relevant background from the issue description>

## Steps

- [01 — Add endpoint](plan/01-add-endpoint.md)
- [02 — Add validation](plan/02-add-validation.md)
- [03 — Wire up UI](plan/03-wire-up-ui.md)

## CI Checks
<Only if a CI config was found in Step 2. Otherwise omit this section entirely.>
- `<folder>`: `<local command>` (CI job: `<job name>`)

## Notes
- <Any caveats, risks, open questions, or unknowns>
```

Each `plan/<NN>-<slug>.md` follows the step-file shape above (`# <Name>` + description + scoped `## Files to Change`).

If the plan is genuinely large for reasons other than step count (e.g. it needs multiple independent topic files), you may still split it into multiple files inside `PLAN_DIR` (e.g. `plan.md`, `plan_api.md`) with `plan.md` acting as the index — same judgment call as in `plan-issue`. This is independent of both the step split above and the agent split in Case B.

### Case A2 — single owner

Exactly one candidate agent has work (`determine_agents.md` recorded `SINGLE_OWNER=<agent-name>`). Write the plan content into `<agent-name>.md`, using the same body shape as Case A1's `plan.md` (`## Overview`, `## Context`, plus either `## Implementation Steps` inline or `## Steps` + step files per the split threshold above, `## Files to Change` or per-step `## Files to Change`, optional `## CI Checks`, `## Notes`), and write a minimal pointer `plan.md` instead of the full content:

```markdown
# Plan: <Issue Title>

Issue: [<id>_<slug>.md](../issues/<id>_<slug>.md)

## Overview
<Brief description of what this plan covers>

See [<agent-name>.md](<agent-name>.md) for the full plan.
```

This preserves the owner's name on disk — `list_plan_agents.sh` picks up `<agent-name>.md` the same way it does for a Case B file — without the overhead of a `## Shared contracts` section, since there is nothing to share with zero other involved agents. When `<agent-name>.md` itself splits its steps (more than 2), its step files live under `<agent-name>/<NN>-<slug>.md`, discoverable via `list_plan_steps.sh <plan_dir> <agent-name>`.

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

### `<agent-name>.md` — one per involved agent, 2 or fewer steps

```markdown
# <Agent Name> Plan: <Issue Title>

Main plan: [plan.md](plan.md)

## Shared contracts

<copy only the part of Step 3's contracts relevant to this agent — what it must
produce and/or what it can rely on other agents producing.>

## Implementation Steps

### Step 1 — <Name>
<Description of what to do and why, scoped to this agent>

### Step 2 — <Name>
<Description of what to do and why, scoped to this agent>

## Files to Change
- `path/to/file.ext` — <what changes and why>

## CI Checks
<Only if applicable to this agent's files. Otherwise omit.>
- `<folder>`: `<local command>` (CI job: `<job name>`)

## Notes
- <Any caveats, risks, open questions, or unknowns scoped to this agent>
```

### `<agent-name>.md` — one per involved agent, more than 2 steps

When an agent's plan has more than 2 steps, apply the "Splitting into step files" rules above: `<agent-name>.md` becomes an index with `## Steps` instead of `## Implementation Steps`, and each step moves to `<agent-name>/<NN>-<slug>.md`.

```markdown
# <Agent Name> Plan: <Issue Title>

Main plan: [plan.md](plan.md)

## Shared contracts

<copy only the part of Step 3's contracts relevant to this agent — what it must
produce and/or what it can rely on other agents producing.>

## Steps

- [01 — Add endpoint](<agent-name>/01-add-endpoint.md)
- [02 — Add validation](<agent-name>/02-add-validation.md)
- [03 — Wire up UI](<agent-name>/03-wire-up-ui.md)

## CI Checks
<Only if applicable to this agent's files. Otherwise omit.>
- `<folder>`: `<local command>` (CI job: `<job name>`)

## Notes
- <Any caveats, risks, open questions, or unknowns scoped to this agent>
```

Each `<agent-name>/<NN>-<slug>.md` follows the step-file shape above (`# <Name>` + description scoped to this agent + scoped `## Files to Change`), discoverable via `list_plan_steps.sh <plan_dir> <agent-name>` (`auto-fix-issue/scripts/list_plan_steps.sh`).

## After writing

The files are complete once saved to disk under `PLAN_DIR`. Do not present an overview or ask "Does this approach look correct?" — proceed directly to Step 5 (commit) in the SKILL.md.
