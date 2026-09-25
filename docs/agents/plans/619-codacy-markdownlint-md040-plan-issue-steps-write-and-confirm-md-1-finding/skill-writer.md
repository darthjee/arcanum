# Plan: Codacy: markdownlint MD040 — plan-issue/steps/write_and_confirm.md (1 finding)

Issue: [619-codacy-markdownlint-md040-plan-issue-steps-write-and-confirm-md-1-finding.md](../../issues/619-codacy-markdownlint-md040-plan-issue-steps-write-and-confirm-md-1-finding.md)

## Overview
Add the `text` language tag to the two bare fenced code blocks in `plan-issue/steps/write_and_confirm.md`, which clears markdownlint MD040. This is a one-line change per fence and does not change the rendered output.

## Context
Codacy reported MD040 at line 129, the fence around the prompt `Does this approach look correct? Anything to add or correct?` (indented three spaces inside step 4 of the confirmation loop). The fence at line 137 around `Would you like to proceed and open a PR to fix this issue now?` (under "Offer to open the PR") has the same problem but was not in the snapshot, and the issue fixes it too. Both blocks hold literal user-facing prompts, so `text` is the right tag. This matches the fix for #617 in `discuss-issue/steps/discuss_and_save.md`.

## Implementation Steps

### Step 1 — Tag both prompt fences as `text`
In `plan-issue/steps/write_and_confirm.md`:
- Line 129: change the bare opening fence to `` ```text `` (keeping the three-space indent).
- Line 137: change the bare opening fence to `` ```text ``.

Leave the closing fences and the prompt text as they are. Don't change any other fence; the rest already have a language.

## Files to Change
- `plan-issue/steps/write_and_confirm.md` — add `text` to the opening fences at lines 129 and 137.

## Notes
- Afterwards, check that no bare opening fences remain in the file (for example, `` grep -n '^ *```$' `` should list only closing fences).
- Don't change `.markdownlint.json`.
