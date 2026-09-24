# Wire the specs folder into the docs

- **`AGENTS.md`:** add a `[Specs](docs/agents/specs/)` row to the Documentation table ("Forward-looking designs that guide future work, not yet implemented."). Add a short `### Specs (docs/agents/specs/)` subsection next to the Issues/Plans ones, describing the naming (`<topic>.md`, kebab-case) and the purpose.
- **`docs/agents/folder-structure.md`:** add a `docs/agents/specs/` row (or extend the `docs/agents/` row) describing the folder.
- **`docs/agents/architecture/script-engine.md`:**
  - Scope boundaries: replace "No per-repo migration script is needed for consuming repos…" with wording that says the key's absence still defaults to `shell` today, and that a global `instructions` migration (`next/001`, #601) warns users of the upcoming removal and offers to set `engine.mode`;
  - See also: add a link to `../specs/shell-engine-removal.md`.

## Files to Change

- `AGENTS.md`: Documentation table row and Specs subsection.
- `docs/agents/folder-structure.md`: specs folder row.
- `docs/agents/architecture/script-engine.md`: Scope boundaries line and See also link.
