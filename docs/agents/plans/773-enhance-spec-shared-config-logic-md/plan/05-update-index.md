# Update the index arcanum-cli.md

Keep `docs/agents/specs/arcanum-cli.md` consistent with the part.

- **"Pieces introduced" table:**
  - Replace the `Lock.js` bounded-wait row with the lock-protocol fix, pointing at #807 (owners `node` + `scripter`), noted as a hard blocker for the CLI's write commands.
  - Replace the "`no-restricted-imports` rule in `core/eslint.config.mjs`" row with the core-side shared-surface block (`node`), and add a row for the CLI-side rule in `cli/eslint.config.mjs` (`client`).
  - Turn the agent-email row from "proposed" into the decided `AgentEmail.js` + `ConfigChain#readWithSource` (`node`), linking the new Shared Config Logic subsection instead of `#open-points`.
  - Add rows: `ConfigError.js` and its adoption in `RepoConfigWriter` / `Lock` / the strict-keys guard (`node`); `cli/scripts/build.mjs` with the metafile surface check (`client`); the always-on CircleCI `cli` job (`infra`), merged with or next to the Node 22.13 floor job row.
  - Resolve the repo-root helper row: `RepoPath#toplevel` on the shared surface (`node`), dropping "if placed in the shared surface".
- **`## Parts`:** Shared Config Logic description — "`ConfigError` decoupling" → "`ConfigError` contract", and add "lock protocol dependency (#807), shared agent-email helper".
- **`## Backward compatibility, testing and security`:** testing bullet "The CLI specs also run when a shared-surface file changes" → "A `cli` CI job runs on every push"; backward compatibility: add the deliberate native `""` agent-email change; security: "Writes only through the shared locking logic" → add "(mutually exclusive once #807 lands)".
- **Targeting** (line ~121): keep the pointer to Shared Config Logic for the helper; it now resolves.
- Grep all of `docs/agents/specs/arcanum-cli*` for `shared-config-logic.md#open-points` and retarget each link to the subsection that now holds the decision.

## Files to Change
- `docs/agents/specs/arcanum-cli.md` — pieces table, parts description, compat/testing/security bullets, retargeted links.
