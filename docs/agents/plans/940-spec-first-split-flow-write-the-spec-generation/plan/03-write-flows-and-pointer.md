# Write flows.md and pointer.md

Each part opens with `# <Title>` and a `Hub: [specs.md](specs.md)` back-link. Write in present-tense normative prose with hard rules as bullets and a short **Rationale** where #938 gave one. Use no origin tags.

## `flows.md` (spec lifecycle, the three flows)

- **Spec lifecycle:** a pipeline spec follows its originating issue. Use a phase table (actor → effect on `docs/agents/specs/`):
  - **Split:** emits the pointer, and the hub does not exist yet.
  - **Generation issue:** creates the hub and parts.
  - **Enhancement issues:** refine it.
  - **Implementation issues:** read it as the technical source of truth.
  - **Fold issue:** folds the durable content, removes the spec, and updates the index.
- **Pipeline-spec status vocabulary,** next to the lifecycle:
  - `Drafting`: at least one enhancement issue is open. The generation issue sets it.
  - `Ready`: every enhancement issue is closed. The enhancement issue that closes last sets it.
  - `Implementing`: the implementation issues exist. The implementation-split issue sets it.
  - There is no final status, because the fold removes the spec.
  - The issue that moves the phase updates the hub's `Status` and the index row's Status in the same PR.
  - Standalone specs keep free-text status.
- **The three flows:** the split interview gains one topic, whether to write specs in `docs/agents/specs/`.
  - **Flow A:** generation, then N enhancements (only if needed), then an implementation-split issue that creates implementation issues *from the spec*, then the fold.
  - **Flow B:** generation, then N enhancements, then N implementation issues, then the fold.
  - **Flow C:** implementation only. This is today's behaviour and stays the default.
- The question and its branching live in the skill. The repository split-checklist template only overrides it or opts out (cross-link `migration.md`). Persisting the flow choice and the config key is an open point (#942). Do not decide it here.

## `pointer.md` (canonical pointer)

- Every generated issue body of a spec-carrying flow carries the pointer. The generation issue creates the file at that path, and every other issue only reads it.
- **Format:**
  - A single line on its own, starting with the literal key `**Spec hub:** `, matched by `^\*\*Spec hub:\*\* `.
  - The value is a Markdown link whose text and target are the same repo-relative **hub** path.
  - The hub path is `docs/agents/specs/<topic>.md` or `docs/agents/specs/<topic>/specs.md`.
  - The issue never lists parts. They are discovered from the hub.
  - Include a short example body for each shape: one with no H1, and one with an H1.
- **Value rules:**
  - The resolver reads the link **text**. When the text and target differ, the pointer is `invalid`.
  - **Rationale:** the link is deliberately not clickable on GitHub. Repo-relative paths stay portable across forks and hosts, and no host, owner or branch is parsed from an issue body.
- **Validation and allowlist:**
  - The path is validated against an allowlist rooted at `docs/agents/specs/`.
  - Absolute paths, `..` segments, and anything escaping that root are rejected before any file read.
- **Placement (the settled refinement):**
  - The pointer goes on the first non-blank line of the body, or, when the body opens with an H1, the first non-blank line after that H1.
  - Emitters (the split and the body templates) write it there, and the push guard re-inserts a dropped pointer at the same spot.
  - The resolver scans the whole body and the first match wins.
  - A pointer elsewhere, or a second pointer line, is honoured but adds a `warnings[]` entry.
  - Mention both body shapes: split sub-issues have no H1 in the body, and epics open with `# <title>`.
- **Parser:** a single parser is shared by the resolver and the push guard. Link `resolver.md` and `guard.md`.

## Files to Change
- `docs/agents/specs/spec-first-split-flow/flows.md` (new): lifecycle, status vocabulary, the three flows.
- `docs/agents/specs/spec-first-split-flow/pointer.md` (new): pointer format, value rules, allowlist, placement.
