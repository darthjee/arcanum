# Validate and Refine Plan

## Analyze the plan

Read the issue file and all plan file(s). Then explore the relevant parts of the codebase to validate the plan against reality. Look for:

- **Gaps** — steps that are missing or underspecified
- **Incorrect assumptions** — things the plan assumes that don't match the actual code
- **Ambiguities** — decisions that are not made yet but need to be
- **Risks** — things that could go wrong or have unintended side effects
- **Inconsistencies** — contradictions within the plan or with the issue description

## Present findings to the user

Present a structured summary of your findings. Group them clearly, for example:

```
## Plan Review: <Issue Title>

### Problems
- <something that is wrong or missing>

### Open Questions
- <something that needs a decision>

### Risks
- <something that could go wrong>

### Looks good
- <aspects that are solid>
```

If the plan looks fully correct and complete, say so clearly and skip to "Offer to open the PR".

## Refine the plan

After presenting your findings, interact with the user to resolve each issue:

- If the user provides an answer or clarification: update the plan file(s) accordingly and confirm the update.
- If the user asks you to research something in the code: explore the relevant parts and incorporate findings into the plan.
- If the user disagrees with a finding: acknowledge it and adjust your understanding.

After each round of updates, re-check if there are remaining open items. If yes, present them. If no, proceed.

## Offer to open the PR

Once the plan is validated and refined, ask:

```
Would you like to proceed and open a PR to fix this issue now?
```

- If the user confirms (yes, sure, go ahead, or similar affirmative): invoke the `/fix-issue <id>` skill, where `<id>` is the issue ID.
- If the user declines: acknowledge and stop.
