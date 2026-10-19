# Update shortcuts-and-setup.md

Point the `agents email` view at the shared helper and record the `""` rule in `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`.

- **`#### Resolution`:** replace "through the shared config logic … (see Shared Config Logic#open-points)" with a direct reference to `AgentEmail#resolve` / `ConfigChain#readWithSource` in [Shared Config Logic](shared-config-logic.md). Add rule 6: an explicit `""` at the winning tier/key stops the chain and means "no email" — the commit falls back to the model email, and the CLI shows `(model default)` with the tier/key where the empty value sits (e.g. `(empty at repo: git.agents.node)`).
- **Listing output:** add an example row (or a sentence) for the empty-value case.
- **Testing:** extend the `agents email` resolution-spec bullet with the `""` case, and state that the shared fixture table is the same one used by the shell/native parity specs.

## Files to Change
- `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` — resolution reference, `""` rule, listing example, testing bullet.
