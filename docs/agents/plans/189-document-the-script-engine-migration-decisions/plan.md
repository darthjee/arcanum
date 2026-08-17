# Plan: Document the script-engine migration decisions

Issue: [189-document-the-script-engine-migration-decisions.md](../issues/189-document-the-script-engine-migration-decisions.md)

## Overview

Write the permanent architecture documentation for the shell → Node.js script-engine migration decided in #168 (and refined during #189's own discussion), then wire it into the existing docs hub and correct two now-stale "no programming language/runtime" claims elsewhere in the repo's docs.

## Context

- #168 decided: Node.js (plain JS, ESM modules, no build step), a shared `engine_dispatch.sh` bash helper consulting a migration-status map, a byte-identical stdout/exit-code contract between shell and native implementations, a single central `core/` Node package (Yarn, zero runtime npm dependencies), Jasmine/c8/ESLint/JSCPD testing with required parity tests, a `darthjee/node`-based Docker test image, and security rules (no string-interpolated `child_process` calls, GitHub token never logged, `yarn audit` in CI).
- #189's own discussion refined the dispatch design further: all native calls route through one centralized executable, `core/bin/arcanum` (no `.js` extension, `#!/usr/bin/env node` shebang, so its calling convention already matches what a future Docker or compiled-binary port would present), invoked as `core/bin/arcanum <command> <args...>`. `arcanum/_lib/engine_dispatch.sh` is the single place that decides shell vs. native (via the migration-status map) and, when native, sets an explicit per-command env-var allowlist before invoking `core/bin/arcanum` — never the full inherited ambient environment.
- None of this exists in permanent, discoverable documentation yet — it only lives in the #168/#189 issue threads.

## Implementation Steps

### Step 1 — Write the new architecture doc

Create `docs/agents/architecture/script-engine.md` describing:

- **The `engine` config key**: what it's for (`shell`/`native`/`docker`), its 3-tier resolution (local state → repo config → global config, following the existing `config_chain.sh` pattern documented in `shared-state-and-configuration.md`), and its finalized exact key path — pick a plain top-level `engine` key (not namespaced under a feature, since this is cross-cutting infrastructure rather than one skill's own setting) and state it explicitly.
- **The dispatch guard**: `arcanum/_lib/engine_dispatch.sh`, shared by every entrypoint shim, parameterized by command/script name. Consults the migration-status map (its exact file path/format is explicitly left open for #192 to decide — describe its *role* and *consulted-not-invoked* behavior, not a concrete path) to know whether a native implementation exists for a given entrypoint. Fallback rules: `engine=native` configured but no native implementation exists yet for this entrypoint → silent fallback to `shell`, with a warning printed (not a hard error); an already-migrated native script that crashes/throws at runtime (a real bug, distinct from "not implemented yet") → fail loud, no automatic fallback.
- **The centralized native entrypoint**: `core/bin/arcanum` (no `.js` extension, `#!/usr/bin/env node` shebang), taking a command name as its first argument (e.g. `core/bin/arcanum resolve_and_fetch <args...>`) and routing internally to the matching module under `core/lib/`. Every migrated entrypoint's native path goes through this one interface — never a direct per-script `node core/lib/<script>.js` call — so porting execution to Docker or a single compiled binary later only ever touches this one seam.
- **Env-var passing**: `engine_dispatch.sh` sets an explicit per-command allowlist of env vars before invoking `core/bin/arcanum <command> <args...>` — never the full inherited ambient environment — keeping the same explicit shape a future `docker run -e VAR=value <image> <command> <args...>` would need.
- **The output/exit-code contract**: native implementations must be byte-identical to their shell counterparts in stdout (the existing `KEY=value` line protocol) and exit code, so skill `.md` steps never need to know or care which engine ran.
- **The `core/` package layout**: a single central Node package (not one per skill), `package.json`, ESLint flat config (2-space indent, single quotes, semicolons, `const`/`let` only, strict `===`, no `console.log`, JSDoc on public functions), Yarn as the package manager, zero runtime npm dependencies (built-in Node APIs only — including the global `fetch` for GitHub REST/GraphQL calls instead of a GitHub SDK, mirroring how today's shell scripts already avoid `gh issue`/`gh api` subcommands in favor of `curl` + `gh auth token`). `core/spec/` mirrors `core/lib/` 1:1, spec files named `<Name>_spec.js`, shared helpers under `core/spec/support/{factories,dummies,utils,fixtures}`.
- **Testing conventions**: Jasmine (runner) + c8 (coverage, lcov reporter, thresholds declared but not hard-enforced yet) + JSCPD (duplication, informational) + `yarn audit` (informational, catches devDependency supply-chain risk). A parity test is required for every migrated entrypoint (shell vs. native, identical inputs, identical stdout + exit code) on top of regular unit tests. No real network calls in CI — `fetch` is mocked/stubbed via fixture data under `core/spec/support/fixtures/`.
- **The Docker test image**: based on `darthjee/node` (Node + warm Yarn cache), source bind-mounted at runtime rather than baked in, doubling later as the base for the `engine: docker` execution path.
- **Security requirements**: no string-interpolated shell execution from native code — any `child_process` call (e.g. `gh auth token`, `git`) must use `execFile`/`spawn` with an argument array, never a string-interpolated `exec()`, since these scripts process untrusted GitHub content (issue titles/bodies). The GitHub token obtained via `gh auth token` must never be printed to stdout/logs.
- **Scope boundaries**: only skill entrypoints (`<skill>/scripts/`, `arcanum/_lib/`) are in scope — not the unrelated top-level `scripts/` folder (repo release/versioning tooling). No per-repo migration script is needed (the `engine` key's absence defaults to `shell`, today's existing behavior). No standalone `_lib` migration — native equivalents of shared bash helper logic grow per-entrypoint need only, inside `core/`, while the original `_lib/*.sh` files stay untouched for callers still on shell.

### Step 2 — Link the new doc from the architecture hub

Add one row to `docs/agents/architecture.md`'s index table (`| File | Covers |`) pointing at `architecture/script-engine.md`, in the same style as the existing rows (e.g. `Per-Repo Migrations`).

### Step 3 — Add the `engine` config key to shared-state-and-configuration.md

Add a row to `docs/agents/architecture/shared-state-and-configuration.md`'s existing table for the new `engine` key, describing which of the documented config-tier files it's read from/written to (repo config + local state, per the 3-tier chain) and its finalized exact path from Step 1.

### Step 4 — Fix the stale "no language/runtime" claims

- Update `AGENTS.md`'s Stack section (currently: "No programming language — the project is composed of markdown files.") to note that a Node.js `core/` package is part of the architecture going forward, and link to the new `script-engine.md` doc. Phrase it so it stays accurate whether read before or after #193 (the first native entrypoint) actually ships.
- Update `docs/agents/architecture/overview-and-layout.md`'s Overview section (currently: "This repository has no application architecture in the traditional sense — there's no running process, no runtime layers.") the same way, cross-linking the new doc.

## Files to Change

- `docs/agents/architecture/script-engine.md` — new file, the full design write-up (create)
- `docs/agents/architecture.md` — add one row linking the new doc
- `docs/agents/architecture/shared-state-and-configuration.md` — add the `engine` config key row
- `AGENTS.md` — correct the "No programming language" Stack line, cross-link the new doc
- `docs/agents/architecture/overview-and-layout.md` — correct the "no runtime" Overview line, cross-link the new doc

## Notes

- This issue is documentation only — no code, no tests, no CI changes.
- The repo's only CI pipeline (`.circleci/config.yml`) runs solely on version-tag pushes (release packaging) and doesn't lint or check docs on PRs, so no `## CI Checks` section applies here.
- The migration-status map's exact file path/format is explicitly left open for #192 (dispatch guard implementation) to decide — this doc should describe its role and consulted-not-invoked behavior without inventing a concrete path that might not match what #192 actually builds.
- The `engine` config key's exact path needs to be decided while writing Step 1 — this plan proposes a plain top-level `engine` key as the natural choice (cross-cutting infrastructure, not namespaced under one feature), but the doc author should confirm this reads consistently with `shared-state-and-configuration.md`'s existing namespacing conventions before finalizing it.
