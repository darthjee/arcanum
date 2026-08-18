# Issue: Scaffold the core/ Node package and add a dedicated node specialist agent

## Description

Before any script can be migrated to Node.js (per #168), arcanum needs a Node package to hold that code, its test tooling wired up, and a specialist agent scoped to own it — none of which exist today.

#168 decided:
- A single central Node package at `core/` (repo root) — not one package per skill — holding all migrated script logic plus its own `package.json`, ESLint config, and test suite.
- Yarn as the package manager (no `npm install`).
- Test stack: **Jasmine** (runner), **c8** (coverage, lcov reporter, thresholds declared but not hard-enforced yet), **ESLint** flat config (2-space indent, single quotes, semicolons, `const`/`let` only, strict `===`, no `console.log`, JSDoc required on public functions), **JSCPD** (duplication, informational only).
- Test layout: `core/spec/` mirrors `core/lib/` 1:1, spec files named `<Name>_spec.js`, shared helpers under `core/spec/support/{factories,dummies,utils,fixtures}`.
- A dedicated Docker test image based on `darthjee/node` (Node + warm Yarn cache), with source bind-mounted at runtime rather than baked in — this same image later doubles as the base for the `engine: docker` execution path.
- Zero runtime npm dependencies for anything shipped in `core/lib/` — only built-in Node APIs at runtime (devDependencies like Jasmine/ESLint are fine, since those never run in a consuming repo).
- The existing top-level `scripts/` folder is unrelated (repo release tooling) and is not reused for this.

Two new specialist agents are added: **`node`** (`.claude/agents/node.md`), dedicated to Node.js source/config under `core/` — parallel to the existing `scripter` agent, which stays scoped to bash only (`<skill>/scripts/`, `arcanum/_lib/`) — and **`infra`** (`.claude/agents/infra.md`), a general repo-wide specialist for Docker/Makefile/compose files.

To validate the whole toolchain end-to-end, this issue includes one trivial mock class + spec (not a real migrated script — just proof the architecture works: lint passes, tests run and produce coverage, the Docker test image builds and runs the suite).

## Problem

There is currently no Node.js package in the repo, no JS test/lint tooling, and no specialist agent scoped to own Node.js code or Docker/Makefile infra. None of #168's shell→Node migration sub-issues — #191 (CI), #192 (dispatch guard), #193 (first migrated entrypoint) — can proceed without this scaffolding in place first.

## Solution

### What needs to be done

- [ ] Create `core/package.json` (Yarn, ESM `"type": "module"`), `core/eslint.config.mjs`, and the Jasmine/c8/JSCPD config (in `package.json` per convention).
- [ ] Create the `core/spec/` tree with `support/{factories,dummies,utils,fixtures}` subfolders.
- [ ] Add one trivial class + spec under `core/lib/`/`core/spec/lib/` purely to validate the setup end-to-end (lint, test, coverage all run cleanly).
- [ ] Add `core/bin/arcanum` (`#!/usr/bin/env node`, no `.js` extension) as a stub for the centralized native entrypoint — no real command routing yet, just proof it's executable and wired into the package.
- [ ] Add a Dockerfile for the test image (`darthjee/node`-based) plus whatever compose/Makefile target runs the suite inside it with source bind-mounted.
- [ ] Add `.claude/agents/node.md` (frontmatter: `name: node`, description scoped to Node.js source/config under `core/`, `tools: Read, Edit, Write, Bash`).
- [ ] Add `.claude/agents/infra.md` (new specialist, frontmatter: `name: infra`, description scoped repo-wide to Docker/Makefile/compose files, `tools: Read, Edit, Write, Bash`); it owns the Dockerfile/compose/Makefile target for `core/`'s test image.
- [ ] Have `architect` reference both `node` and `infra` in `AGENTS.md`'s Agents table alongside the existing specialist agents, and update the "No programming language" Stack line to reflect that `core/` is now a Node.js package.
- [ ] Add `node` and `infra` entries under `git.agents` in `.claude/configuration/arcanum-repo-config.json` (`darthjee+backend@gmail.com` and `darthjee+infra@gmail.com` respectively).
- [ ] Have `node` add a `core/` row to `docs/agents/folder-structure.md`'s top-level directory table.

### Depends on

The architecture doc from the "Document the script-engine migration decisions" sub-issue (#189, merged) — this issue builds against its finalized conventions.

### Scope boundaries

Scaffolding in this issue includes `core/bin/arcanum`, the centralized native entrypoint described in the architecture doc — it's part of the `core/` package skeleton, not deferred to #192 (dispatch guard) or #193 (first migrated entrypoint). At this stage it can be a stub that doesn't yet route to any real migrated command (nothing is migrated yet in this issue), since no `arcanum/_lib/engine_dispatch.sh` caller exists to invoke it until #192.

### Agent scope decisions

Two specialist agents are involved, split by file type rather than by feature:

- **`node`** (`.claude/agents/node.md`) — owns `core/lib/`, `core/spec/`, `core/bin/`, and `core/package.json`/`core/eslint.config.mjs` (the JS/JSON source and config). Tools: `Read, Edit, Write, Bash` (parallel to `scripter`). Does **not** edit `AGENTS.md` — that stays `architect`'s job (root-level file, spans agents) — but `node` does own updating the `docs/agents/` documentation for the parts of `core/` it builds (e.g. architecture doc follow-ups, and the `core/` row in `docs/agents/folder-structure.md`), same pattern as `scripter` staying out of skill `.md` files.
- **`infra`** (new agent, `.claude/agents/infra.md`) — a general-purpose, repo-wide specialist for Docker/Makefile/compose files, not scoped narrowly to this issue's test image. Owns any `Dockerfile`, `docker-compose*.yml`, and `Makefile` in the repo. Tools: `Read, Edit, Write, Bash`. Also gets a row in `AGENTS.md`'s Agents table (added by `architect`, same as `node`'s row).

### Edge cases

- **Shipping `core/` to consuming repos is out of scope here.** This issue only builds `core/` as dev/test tooling inside the arcanum repo itself. Whether/how `core/lib`+`core/bin` reach a consuming repo's install (bundled into the release zip alongside `arcanum/_lib`, or some other mechanism) is undecided and belongs to a later sub-issue (likely #192 or a new one) — noted here so the gap isn't lost, not resolved.
- **Docker is not mandatory for local dev.** `yarn test`/`yarn lint` must work directly on a contributor's machine without Docker; the Docker image is for CI parity and the future `engine.mode=docker` path, not a hard requirement to run the suite locally.
- **`yarn.lock` is committed** to the repo as the source of truth for dependency versions, consumed by both local `yarn install` and the Docker image's warm cache.
- **Node version pinning**: `core/package.json` declares an `engines.node` field matching whatever Node version `darthjee/node` bundles, so a version mismatch fails fast locally instead of surfacing as a confusing lint/test discrepancy.

### Testing strategy

- **Coverage thresholds**: declared in `c8`'s config (in `package.json`) at a low, permissive placeholder value (e.g. 50%) — just proving the threshold key is read and honored by the tool, not a real quality bar. Real enforcement values come later once actual migrated code exists to measure.
- **No parity test for the trivial validation class.** The architecture doc's "parity test required for every migrated entrypoint" rule doesn't apply here — the trivial class is scaffolding proof, not a real shell→native migration, so it gets a normal unit spec only.
- **Docker verification is manual for this issue.** Acceptance is a human running the documented Makefile/compose target locally and confirming the suite passes inside the container — no automated check is added, since wiring this into CI is explicitly #191's job.

### Trivial validation class

- **Lifespan**: temporary. It exists only to prove the toolchain (lint, test, coverage) works end-to-end before any real migration lands. Once #193 lands a real migrated entrypoint under `core/lib/`, that real code + its spec takes over as the pipeline proof, and #193's scope should include deleting this class and its spec — `core/lib/` should only ever hold genuine migrated logic, not permanent placeholders.
- **Content**: a simple pure function with a branch, so coverage/tests have to exercise more than one path. E.g. `core/lib/Greeter.js` exporting a `Greeter` class with a `greet(name)` method: returns `` `Hello, ${name}!` `` when `name` is given, `'Hello, stranger!'` when it's falsy.
- **Location**: `core/lib/Greeter.js`, spec at `core/spec/lib/Greeter_spec.js` — matching the `core/spec/` mirrors `core/lib/` 1:1 convention from the architecture doc.

### Commit author config

Both new agents get an entry under `git.agents` in `.claude/configuration/arcanum-repo-config.json`:

- `"infra": "darthjee+infra@gmail.com"` — literal name, matching the `{agent}` template default.
- `"node": "darthjee+backend@gmail.com"` — reuses `scripter`'s existing `backend` alias rather than a new literal/role email.

## Benefits

- Unblocks #191 (CI wiring), #192 (dispatch guard), and #193 (first migrated entrypoint) — none of which can start without `core/` and its tooling existing.
- Establishes reusable conventions (test layout, lint rules, Docker test image) that every future migrated script follows, rather than each sub-issue reinventing them.
- Introduces a durable `infra` specialist for Docker/Makefile/compose ownership, useful for infra work beyond this migration.
