# Ownership and the `client` agent

Update the index's "Ownership" section with the issue's "`client` agent's role" decisions.

- State that the `client` conventions list is the input for #775; once #775 lands, `.claude/agents/client.md` is the source of truth for `client`'s working conventions.
- Add rows (or a second table "Pieces introduced by this spec's decisions"):
  - Runtime Node-version check in `cli/bin/arcanum` — `client`
  - Spec asserting `cli/` `engines.node` equals `core/`'s — `client`
  - Embedding the per-scope migration-version list in the build (read-only on `arcanum/migrations/repos/*/migrations.json`) — `client`
  - CircleCI job running `cli/` specs on Node 22.13 — `infra`
  - Repo-root normalizing helper, if placed in the shared surface — `node` (placement detailed in Shared Config Logic)
  - `no-restricted-imports` rule in `core/eslint.config.mjs` — `node`
- Note that the key registry's owner is decided in Key Registry, not here.
- Add the cross-boundary rule: a PR changing a shared-surface file keeps the CLI specs green in the same PR; the planner splits such plans across `node` and `client`; `client` never edits `core/lib`, `node` never edits `cli/`.
- Mention that `client` gets a `git.agents` entry in this repo's `arcanum-repo-config.json` reusing an existing persona alias (exact alias chosen in #775).

## Files to Change

- `docs/agents/specs/arcanum-cli.md` — "Ownership" section.
