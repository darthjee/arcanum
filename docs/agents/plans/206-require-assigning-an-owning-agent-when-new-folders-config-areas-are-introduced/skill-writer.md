# Skill-Writer Plan: Require assigning an owning agent when new folders/config areas are introduced

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add the ownership-check consideration to `discuss-issue/steps/discuss_and_save.md`'s step 4

The current step 4 ("Generate clarifying questions") reads:

```markdown
## 4. Generate clarifying questions

Based on the current draft and any agent findings, generate a short list of clarifying questions that would meaningfully change the issue file — scope boundaries, constraints, edge cases, intent behind ambiguous requests. Do not ask questions the draft already answers.

If there are no meaningful open questions, treat comprehension as already satisfied and skip directly to step 7 (the comprehension check) without presenting questions.
```

Add a standing consideration before the "no meaningful open questions" paragraph, so it's always checked even when the rest of the draft looks otherwise complete:

```markdown
Always check one more thing before deciding there are no open questions: does this issue describe introducing a new **top-level (root) folder** in the repo? If so, the draft is not complete until an explicit owning agent is named — extend an existing agent's scope, assign a new specialist, or deliberately record `architect` for genuinely cross-cutting/root-level folders — never left unanswered because no specialist obviously fits. If the draft doesn't already answer this, add "which agent should own `<folder>`?" to the clarifying questions below, phrased to require naming one agent rather than a yes/no.
```

Match the existing file's heading level, tone, and paragraph style — this is one added paragraph within the existing step, not a new numbered step.

### Step 2 — Cross-reference `enhance-issue`

`enhance-issue/steps/dialogue.md` already reads `docs/agents/issue-enhancement.md`'s checklist dynamically (no skill-file edit needed there — `architect` adds the matching checklist item directly, see [plan.md](plan.md)'s Architect steps). Confirm `dialogue.md` needs no change of its own before finishing this file — it shouldn't, since it already generically "builds the topic checklist" from that file's contents, but verify the current wording still holds before marking this done.

## Files to Change

- `discuss-issue/steps/discuss_and_save.md` — add the standing ownership-check consideration to step 4 (Step 1 above).

## Notes

- Keep this addition equivalent in substance to the checklist item `architect` adds to `docs/agents/issue-enhancement.md` in the same plan (same trigger: root-level folders only; same no-silent-default rule) — phrased for `discuss-issue`'s own flow rather than copied verbatim, since the two skills read their checklists from different places.
- No script work: this is a documentation/instruction-text change only, nothing deterministic to extract.
