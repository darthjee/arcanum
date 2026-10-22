# Fix the spec's repointing note

In `docs/agents/specs/shared-lib.md`, the paragraph under the "Implementation order" table says the agent files (`node.md`, `scripter.md`, `client.md`) are repointed in #819. Change it:

- #819 keeps the current paths in the agent files, with a "moves to `shared/lib/` in #824" note;
- #820 and #824 repoint those paths as they move the files.

Also bring the Ownership section's `node` and `client` rows in line with ownership by folder. `node` owns `core/`'s source and config, including the surface while it lives in `core/`, "minus the surface" once #824 removes the copy. Leave the end state unchanged.

## Files to Change

- `docs/agents/specs/shared-lib.md`: the Implementation order note; the Ownership rows for `node` and `client`.
