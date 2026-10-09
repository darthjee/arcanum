# Specs index and split-spec convention

Create `docs/agents/specs.md`, a permanent index of every current and future spec. Add one entry per spec with its link, a one-line summary and its status. Seed it with `specs/shell-engine-removal.md` (Proposed) and `specs/docker.md` (In progress, epic #724). Add a short intro: specs are forward-looking designs; every new spec gets an entry here; a large spec may be split into an index file plus parts.

Document the split convention: a spec is `docs/agents/specs/<topic>.md`, or for a large one `docs/agents/specs/<topic>.md` (index) + `docs/agents/specs/<topic>/*.md` (parts). Every spec is listed in `docs/agents/specs.md`.

## Files to Change
- `docs/agents/specs.md` — new permanent specs index.
- `AGENTS.md` — docs table: point the "Specs" row at `docs/agents/specs.md`; "Specs" section: add the split convention (`<topic>.md` + `<topic>/*.md`) and the rule that every spec is listed in `docs/agents/specs.md`.
- `docs/agents/folder-structure.md` — `docs/agents/specs/` row: mention the optional `<topic>/` parts folder and the `docs/agents/specs.md` index.
