# Unit tests, parity tests, dispatch verification

Follow `docs/agents/architecture/script-engine.md`'s testing conventions: Jasmine, c8 coverage, no real network calls (mock/stub `fetch` via `core/spec/support/fixtures/`), a required shell-vs-native parity test per migrated entrypoint.

- **`core/spec/ConfigChain_spec.js`**: 3-tier resolution order, multi-key-per-tier precedence (a tier is fully resolved across all given keys before advancing), `null`-treated-as-absent falling through, an explicit `""` stopping the chain, and fail-open behavior on missing/malformed files at any tier.
- **`core/spec/AutoFixAllGithub_spec.js`**: cover all 7 methods —
  - `prNumber`/`prState`: cache hit vs. miss, REST lookup, not-found error path.
  - `prMerge`: all three body modes (`empty`/`full`/`coauthors`), the coauthors dedup/exclusion logic (merger-login exclusion, `modelEmail` exclusion gated on `omit_model_coauthor`, `remove_coauthors` exclusion, empty-list fallback to `full`), the merge REST call, and the post-merge branch-delete call (including its own "already deleted" tolerance).
  - `cleanupBranch`: the 4-command git sequence, remote-delete failure tolerance.
  - `hasShipitLabel`: present/absent/case-insensitivity/fetch-failure.
  - `addTag`/`removeTag`: shipit-guard rejection, already-in-desired-state no-op, successful mutation, fetch/mutation failure paths.
- **Parity tests** (shell vs. native, identical stdout/exit code) for each of the 7 subcommands, same pattern as the existing `core/spec/bin/autoFixAllWaitCiParity_spec.js`.
- **Dispatch verification**: confirm `arcanum/_lib/engine_dispatch.sh` correctly routes each of the 7 `auto-fix-all-github-*` command names to shell when `engine.mode=shell` (or unset) and to `core/bin/arcanum` when `engine.mode=native`, now that `migration-status.json` marks this entrypoint migrated.

## Files to Change

- `core/spec/ConfigChain_spec.js` — new spec file.
- `core/spec/AutoFixAllGithub_spec.js` — new spec file.
- `core/spec/bin/` (or wherever the existing parity specs live) — new parity spec(s) for the 7 subcommands.
