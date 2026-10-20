# Trim the CLI spec

In `docs/agents/specs/arcanum-cli.md`'s "Ownership" section:

- Replace the "`client` conventions" bullet list with one sentence pointing to `.claude/agents/client.md` as the source of truth for `client`'s working conventions. Keep the ownership tables, the tools line and the cross-boundary rules.
- Replace "The alias is chosen in #775." with the decision: `client` reuses `+frontend` (shared with `skill-writer`).
- Update "must be created ... That is sub-issue #775." to state the agent now exists.

## Files to Change
- `docs/agents/specs/arcanum-cli.md` — trim conventions list, record alias, note the agent exists.
