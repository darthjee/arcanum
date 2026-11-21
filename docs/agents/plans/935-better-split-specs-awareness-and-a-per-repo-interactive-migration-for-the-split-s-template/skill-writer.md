# Skill-writer Plan: Split specs awareness: Specs concern in the split checklist and a per-repo migration to add it

Main plan: [plan.md](plan.md)

## Shared contracts

- None consumed or produced beyond wording consistency: the steps refer to `docs/agents/specs.md` and `docs/agents/specs/`, the same paths the Specs bullet in [plan.md](plan.md#shared-contracts) names. The split must still write only issue drafts.

## Implementation Steps

### Step 1 — Read specs during exploration

In `arcanum-split-issue/steps/explore.md`, add item 4 to the "Look for" list:

> 4. Existing specs — if `docs/agents/specs.md` exists, read it and open the specs whose topic overlaps the issue; they are agreed designs that constrain the split. Skip if missing.

### Step 2 — Propose "write the spec" sub-issues

In `arcanum-split-issue/steps/discuss.md`, step 2 ("Discuss"), add after the paragraph that uses the checklist:

> If a part of the work needs a design that no spec covers yet, propose a dedicated "write the spec" sub-issue (sequenced first) rather than having the split author the spec itself.

## Files to Change

- `arcanum-split-issue/steps/explore.md`: new item 4.
- `arcanum-split-issue/steps/discuss.md`: added sentence in step 2.

## CI Checks

- Repo root: markdown lint (`.markdownlint.json`).

## Notes

- No script calls are added, so no `skill-reviewer` exit-4 concerns apply.
