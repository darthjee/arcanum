# Register the spec in the specs index

Add a row to the table in `docs/agents/specs.md`, as `AGENTS.md` § Specs requires for every new spec:

| Spec | Summary | Status |
| --- | --- | --- |
| [Shared Lib](specs/shared-lib.md) | Extract the code shared by `core/` and `cli/` (starting with the config surface) into a root `shared/` lib owned by a new `shared` agent. | Proposed |

If the spec was split (see `plan.md`'s Notes), list only the index file.

## Files to Change

- `docs/agents/specs.md`: new row.
