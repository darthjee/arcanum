# Add the spec-pipeline architecture stub

Create `docs/agents/architecture/spec-pipeline.md` as a stub, so the fold map destination exists and the fold (#946) has a place to fill. It holds no contract text, so there is one copy of the truth until the fold.

Content:

- Title: `# Spec Pipeline`.
- One purpose paragraph: this doc will hold the runtime contract of the spec pipeline, covering the issue-to-spec pointer, the shared resolver, the shared dialogue, the push guard, "blocked by" ordering, and the fold.
- A note that the contract currently lives in the spec hub, [Spec-first split flow](../specs/spec-first-split-flow/specs.md), and is folded into this file by #946.

Then add a row to the hub table in `docs/agents/architecture.md`. Put it after `Skill Finish`, or wherever reads naturally:

```markdown
| [Spec Pipeline](architecture/spec-pipeline.md) | The runtime contract of the spec pipeline (issue-to-spec pointer, resolver, dialogue, push guard, ordering, fold). Currently a stub: the contract lives in the spec-first-split-flow spec until #946 folds it in. |
```

Do not mention the spec in `docs/agents/flow.md` or `AGENTS.md`.

## Files to Change
- `docs/agents/architecture/spec-pipeline.md` (new): the stub.
- `docs/agents/architecture.md`: the new hub table row.
