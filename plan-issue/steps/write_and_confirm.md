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

...

## Files to Change
- `path/to/file.ext` — <what changes and why>

## Notes
- <Any caveats, risks, open questions, or unknowns>
```

If splitting into multiple files, `plan.md` should serve as the index with links to the other files.

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

1. Explore the relevant parts of the project folder identified earlier to understand:
   - What code is affected or needs to be created
   - Existing patterns, conventions, and structure
   - Dependencies or constraints
   - Which top-level folders will contain changes — then read `.circleci/config.yml` (if present) to identify which CI jobs apply to those folders and what local commands run them

2. Update the plan with findings and add a `## CI Checks` section if applicable:
   ```markdown
   ## CI Checks
   Before opening a PR, run the following checks for the folders being modified:
   - `<folder>`: `<local command>` (CircleCI job: `<job name>`)
   ```

3. Present the updated overview and ask again:
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
