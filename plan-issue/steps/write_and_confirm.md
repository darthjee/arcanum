# Write and Confirm Plan

## Discuss the issue with the user

Based solely on the issue description (do **not** look at the code yet), write a draft plan and present it to the user.

Write the plan file(s) in English, regardless of the language used in the issue or by the user.

Model `plan.md` after this structure (adapt sections as needed):

```markdown
# Plan: <Issue Title>

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

## Notes
- <Any caveats, risks, open questions, or unknowns>
```

If splitting into multiple files, `plan.md` should serve as the index with links to the other files. This is the same judgment call `auto-plan-issue` makes for a genuinely large plan, and is independent of the step split below.

### Splitting steps into their own files

This mirrors `auto-plan-issue/steps/write_plan.md` exactly, so `plan-issue` and `auto-plan-issue` produce byte-for-byte the same shape for the same input. If the plan involves multiple specialist agents (an `<agent-name>.md` per agent, e.g. via a coordinator's guidance), apply the same rules to each `<agent-name>.md`; otherwise apply them to `plan.md` itself.

**Step file naming**: `<agent-name>/<NN>-<slug>.md` — two-digit zero-padded step number plus a short descriptive slug (e.g. `backend/01-add-users-endpoint.md`). When there is no agent split, use `plan/<NN>-<slug>.md` instead, rooted at `plan.md`.

**Split threshold**: after drafting the steps, count them.
- **1–2 steps**: keep them inline under `## Implementation Steps` in the single file, as in the template above — no subfolder, no separate step files.
- **3 or more steps**: move the steps out into per-step files, and turn the file that held them into an index instead:

```markdown
## Steps

- [01 — Add endpoint](plan/01-add-endpoint.md)
- [02 — Add validation](plan/02-add-validation.md)
- [03 — Wire up UI](plan/03-wire-up-ui.md)
```

(`## Steps` replaces `## Implementation Steps`; `## CI Checks` and `## Notes`, when present, stay in the index, scoped to the whole plan — not duplicated per step.)

Each step file, `plan/<NN>-<slug>.md` (or `<agent-name>/<NN>-<slug>.md` when there is an agent split), is self-contained — no `### Step N` heading, since the filename and index link already convey ordering and name:

```markdown
# <Name>
<Description of what to do and why>

## Files to Change
- `path/to/file.ext` — <what changes and why>
```

`## Files to Change` here is scoped only to that specific step — pull the subset of the overall file list relevant to this step, not the full list.

## Present an overview and ask for confirmation

Present a high-level overview of the plan to the user. Include:
- A summary of what will be implemented
- The main steps or phases
- Any notable design decisions or trade-offs
- Open questions or unknowns that need to be resolved

End with:

```
Does this approach look correct? Anything to add or correct?
```

Wait for the user's response. During this interaction:

- If the user requests changes or additions, update the plan file(s) accordingly and present the overview again.
- If the user asks a question about the plan:
  - If the answer is already covered in the plan, answer it directly.
  - If the answer is **not yet in the plan and is not known**, say so honestly — do not speculate or invent an answer. Example: *"That's not defined in the plan yet — I don't know."*
  - The user may then either:
    - **Provide the answer or specification directly** — incorporate it into the plan and confirm the update.
    - **Ask the agent to research it** — see "Analyzing the codebase" below.

Repeat until the user confirms the plan is satisfactory.

## Analyzing the codebase

**Do not look at code unless the user explicitly asks or permits it.**

When the user asks you to look at the code (e.g., "check the code", "look at the codebase", "research it", or similar), then:

1. Prefer delegating to the target repo's own agents (set up via `init-claude`) over exploring inline yourself:
   - Run `../scripts/list_agents.sh` (resolved relative to this file's directory; defaults to `.claude/agents` under the current project root) to list the repo's configured agents. Each line has the form `<name>|<description>`.
   - **No output** — the repo has no `.claude/agents/` set up. Skip to step 2 below and explore inline yourself.
   - **One or more lines** — detect a coordinator agent by description, reusing [`auto-plan-issue/steps/determine_agents.md`](../../auto-plan-issue/steps/determine_agents.md)'s "Exclude the coordinator" heuristic (description mentions things like "coordinator", "coordinates other agents", "spans more than one agent's scope").
     - **Coordinator found** — delegate through it: `Agent(<coordinator-name>, ...)` with the research question; the coordinator decides whether to explore directly or fan out to its own specialists.
     - **No coordinator, but specialist agents exist** — match the issue's topic/paths against each specialist's documented `description` and spawn the matching specialist directly.
     - **No coordinator and no specialist agents remain** — skip to step 2 below and explore inline yourself.

2. If no repo agent handled the investigation (no `.claude/agents/`, or no matching coordinator/specialist), explore the relevant parts of the project folder identified earlier yourself to understand:
   - What code is affected or needs to be created
   - Existing patterns, conventions, and structure
   - Dependencies or constraints
   - Which top-level folders will contain changes — then read `.circleci/config.yml` (if present) to identify which CI jobs apply to those folders and what local commands run them

3. Update the plan with findings (your own, or the dispatched agent's report) and add a `## CI Checks` section if applicable:
   ```markdown
   ## CI Checks
   Before opening a PR, run the following checks for the folders being modified:
   - `<folder>`: `<local command>` (CircleCI job: `<job name>`)
   ```

   `## CI Checks` always belongs on the index file, never on a per-step file, even when the plan is split into per-step files: `plan.md` when there is no agent split (or when it wasn't split into steps at all), or the relevant `<agent-name>.md` when there is an agent split. Never add `## CI Checks` to a `plan/<NN>-<slug>.md` or `<agent-name>/<NN>-<slug>.md` step file.

4. Present the updated overview and ask again:
   ```
   Does this approach look correct? Anything to add or correct?
   ```

## Offer to open the PR

Once the plan is confirmed, ask:

```
Would you like to proceed and open a PR to fix this issue now?
```

- If the user confirms (yes, sure, go ahead, or similar affirmative): invoke the `/auto-fix-issue <id>` skill, where `<id>` is the issue ID parsed in Step 2.
- If the user declines: acknowledge and stop.
