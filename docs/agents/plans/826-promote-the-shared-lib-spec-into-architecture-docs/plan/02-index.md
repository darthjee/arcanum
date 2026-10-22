# Index it

Add a row to the table in `docs/agents/architecture.md`, after the Script Engine row (both are about the Node side): `[Shared Lib](architecture/shared-lib.md)`, covering "The root `shared/` lib consumed by both `core/` and `cli/`: layout, the import boundary, ownership, packaging and CI, and the `RepoConfigWriter` API."

`AGENTS.md`'s Architecture row lists the hub's topics in prose. Add "the shared lib" to that list.

## Files to Change

- `docs/agents/architecture.md`: new index row.
- `AGENTS.md`: add the topic to the Architecture hub summary.
