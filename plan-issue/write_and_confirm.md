# Write and Confirm Plan

## Analyze the codebase

Based on the issue description, explore the relevant parts of the codebase to understand:
- What code is affected or needs to be created
- Existing patterns, conventions, and structure
- Dependencies or constraints
- Which top-level folders will contain changes — then read `.circleci/config.yml` (if present) to identify which CI jobs apply to those folders and what local commands run them

## Write the initial plan

Write the plan file(s) in English, regardless of the language used in the issue or by the user.

Model `plan.md` after this structure (adapt sections as needed):

```markdown
# Plan: <Issue Title>

## Overview
<Brief description of what this plan covers>

## Context
<Relevant background from the issue and codebase analysis>

## Implementation Steps

### Step 1 — <Name>
<Description of what to do and why>

### Step 2 — <Name>
<Description of what to do and why>

...

## Files to Change
- `path/to/file.ext` — <what changes and why>

## CI Checks
Before opening a PR, run the following checks for the folders being modified:
- `<folder>`: `<local command>` (CircleCI job: `<job name>`)

## Notes
- <Any caveats, risks, or follow-up considerations>
```

If splitting into multiple files, `plan.md` should serve as the index with links to the other files.

## Clarify open questions

After writing the initial plan, determine if there is anything unclear or ambiguous that the user must decide. If so, ask all questions at once in a numbered list. Wait for the user's answers, then update the plan file with the clarified information.

If everything is clear, skip this step.

## Present an overview

Present a high-level overview of the plan to the user. Include:
- A summary of what will be implemented
- The main steps or phases
- Any notable design decisions or trade-offs

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
    - **Ask the agent to research it** — explore the codebase or relevant context to reach a conclusion, then present the finding to the user before updating the plan.

Repeat until the user confirms the plan is complete.

## Offer to open the PR

Once the plan is confirmed, ask:

```
Would you like to proceed and open a PR to fix this issue now?
```

- If the user confirms (yes, sure, go ahead, or similar affirmative): invoke the `/fix-issue <id>` skill, where `<id>` is the issue ID parsed in Step 2.
- If the user declines: acknowledge and stop.
