# Update the roster docs

- **`AGENTS.md`:** add a `shared` row to the agents table, after `client`: "All of `shared/`: code consumed by both `core/` and `cli/` (`shared/lib/`, `shared/spec/`, `shared/package.json`, `shared/eslint.config.mjs`, `shared/README.md`)."
- **`docs/agents/architecture/agent-roster-and-delegation.md`:**
  - Add a `shared` row to the roster table, with a "When to delegate" cell: "Whenever code under `shared/` (the lib consumed by both `core/` and `cli/`), its specs or its tooling config need to be written or edited."
  - Rewrite the "**The `node`/`client` shared surface**" paragraph to describe ownership by folder:
    - the CLI bundles the shared config surface;
    - while it lives in `core/lib` (until #824), `node` owns it and a PR changing it keeps the CLI specs green in the same PR;
    - once it lives in `shared/lib`, `shared` owns it, and `node` and `client` request changes through `architect`;
    - the `keys.json` exception;
    - link the [Shared Lib spec](../specs/shared-lib.md).
- **`docs/agents/folder-structure.md`:** add a `shared/` row after `cli/`:
  - "Code shared by `core/` and `cli/`, owned by the `shared` specialist agent. Created by #822; until #824 the config surface also lives in `core/lib/shared/`. See `docs/agents/specs/shared-lib.md`."
  - Note that `shared/` lands in the install's skills dir (`<skills>/shared/`), so `shared` is a reserved skill name. Claude Code ignores the folder because it has no `SKILL.md`, as with `core/` and `arcanum/`.

## Files to Change

- `AGENTS.md`: a `shared` row in the agents table.
- `docs/agents/architecture/agent-roster-and-delegation.md`: a `shared` row; the shared-surface paragraph rewritten.
- `docs/agents/folder-structure.md`: a `shared/` row, with the reserved skill name.
