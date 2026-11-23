# Amend the specs contract and index

Make the specs contract describe the hub path this spec uses, and register the spec. Keep the amendment minimal and additive. Existing specs and their links stay unchanged.

- **File layout:** add a third line for the directory hub form, next to the existing `<topic>.md` form, for example:

  ```text
  docs/agents/specs/<topic>.md          # topic hub; may contain the complete small spec
  docs/agents/specs/<topic>/specs.md    # topic hub in directory form; its parts sit beside it
  docs/agents/specs/<topic>/<part>.md   # detailed part of a larger spec
  ```

  After the block, add one sentence: the hub is either `<topic>.md` or `<topic>/specs.md`, and only the hub is listed in the index.
- **Writing specs:** update the first bullet (or add one right after it) to say a spec may instead start as a topic directory whose entry point is `docs/agents/specs/<topic>/specs.md`, with its parts in the same directory.
- **Do not add** issue-originated specs, `## Fold map`, the pipeline status vocabulary, or removal-at-completion wording. They stay in #938's implementation item 1.
- **Active specs table:** add a row after `Shell Engine Removal`:

  ```markdown
  | [Spec-first split flow](specs/spec-first-split-flow/specs.md) | Spec-first flows for `arcanum-split-issue`: the issue-to-spec pointer, the shared resolver, dialogue and push guard, "blocked by" ordering, and the fold back into `docs/agents`. | Drafting |
  ```

- Do not touch `init-claude/templates/specs.md`.

## Files to Change
- `docs/agents/specs.md`: hub-form amendment in **File layout** and **Writing specs**, plus the new Active specs row (Status `Drafting`).
