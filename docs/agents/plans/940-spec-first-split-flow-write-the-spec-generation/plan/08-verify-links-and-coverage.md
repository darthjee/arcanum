# Verify links and coverage

There is no code to test, so check the docs by hand before opening the PR.

- **Links:** every relative Markdown link in each of these resolves to an existing file (and anchor, where one is used):
  - the hub
  - the nine parts
  - `docs/agents/architecture/spec-pipeline.md`
  - the new `docs/agents/specs.md` row
  - the new `docs/agents/architecture.md` row

  A quick way is to extract each `](...)` target, drop any `#anchor`, resolve it against the file's directory, and check `test -e`.
- **Parts:** each of the nine parts appears in the hub's `## Parts` list and in its `## Fold map`. Each one links back to `specs.md`.
- **Decision coverage:** each of #938's D1–D12 is covered, each in exactly one part (see the mapping in the plan Notes). The scope, the confirmed assumptions, the acceptance criteria and the risks are all present. The pointer-placement refinement replaces the "after the H1, before `## Context`" wording everywhere it would appear (`pointer.md` and `guard.md`).
- **Style:** no origin tags (`#938 D<n>`, `decision <n>`) appear in the parts. The hub's `Origin: #938` is the only reference to the epic. `#941`–`#946` appear only in the hub header, Open points, and cross-references to open topics.
- **Scope:** the diff touches only the files below. In particular, it does not touch `docs/agents/flow.md`, `AGENTS.md` or `init-claude/templates/specs.md`.

## Files to Change
- None. This step is verification only, covering:
  - `docs/agents/specs/spec-first-split-flow/*.md`
  - `docs/agents/specs.md`
  - `docs/agents/architecture/spec-pipeline.md`
  - `docs/agents/architecture.md`
