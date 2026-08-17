# Issue: Document the script-engine migration decisions

## Description
Issue #168 discussed and decided the full architecture for migrating arcanum's skill entrypoint scripts from shell to Node.js. This issue turns those decisions into permanent, discoverable project documentation before any of the implementation sub-issues (#190-#193) start building against them.

## Problem
The full design (language choice, dispatch guard, output contract, package layout, testing approach, Docker plan, security rules, and scope) currently exists only inside the #168 issue thread. Nothing is written into the repo's permanent documentation, and two existing docs (`AGENTS.md`'s Stack section, `docs/agents/architecture/overview-and-layout.md`) currently make the now-outdated claim that this repo has no programming language / no runtime. Future contributors, including the other split-off sub-issues, would otherwise have to reconstruct the design from a GitHub issue discussion instead of referencing a stable doc.

## Solution
- [ ] Write a new architecture doc (e.g. `docs/agents/architecture/script-engine.md`) capturing the full design decided in #168 and refined in this discussion: the `engine` config key and its 3-tier resolution, the dispatch guard's behavior (including the migration-status map and fallback/failure rules - noting its exact file path/format is an implementation detail left to #192, not decided here), the output/exit-code contract, the `core/` package layout and its test/CI conventions, the zero-runtime-dependency rule, and the security requirements (no string-interpolated `child_process` calls, token handling).
- [ ] Document the centralized native-invocation design: a single executable entrypoint, `core/bin/arcanum` (no `.js` extension, `#!/usr/bin/env node` shebang - so its calling convention already looks like a real CLI binary, matching what a future Docker or compiled-binary port would present), takes a command name as its first argument (e.g. `core/bin/arcanum resolve_and_fetch <args...>`) and routes internally to the matching module under `core/lib/`. Every migrated entrypoint's native path goes through this one interface - never a direct per-script `node core/lib/<script>.js` call - so porting execution to Docker or a single compiled binary later only ever touches this one seam.
- [ ] Document that `arcanum/_lib/engine_dispatch.sh` (the shared shell helper from #168, reused by every entrypoint shim) is also the single place that constructs the native call: it consults the migration-status map to decide shell vs. native, and when native, sets an explicit per-command allowlist of env vars (never the full inherited ambient environment) before invoking `core/bin/arcanum <command> <args...>` - keeping the env-passing shape identical to what a future `docker run -e VAR=value <image> <command> <args...>` would need.
- [ ] Finalize and document the exact `engine` config key path (e.g. top-level `engine` vs. a nested `engine.mode`) across the 3-tier config chain - this is a naming/shape decision this issue pins down, unlike the migration-status map's format which stays open for #192.
- [ ] Link the new doc from `docs/agents/architecture.md`'s index table.
- [ ] Add a row to `docs/agents/architecture/shared-state-and-configuration.md` for the new `engine` config key (repo config + local state tiers), using the finalized key path.
- [ ] Cross-link this doc from `AGENTS.md`'s "No programming language" Stack line and from `docs/agents/architecture/overview-and-layout.md`'s "no runtime" description - both currently make a claim this migration makes forward-looking rather than accurate, until the first entrypoint (#193) actually ships as native.

## Benefits
- Gives the later sub-issues (#190 scaffolding, #191 CI, #192 dispatch guard, #193 first entrypoint) a stable reference to build against instead of re-deriving context from the #168 discussion thread.
- The centralized `core/bin/arcanum` entrypoint keeps the eventual Docker/compiled-binary port to a single seam instead of N per-script call sites.
- Keeps `AGENTS.md` and the architecture doc hub accurate and internally consistent as this migration progresses.
