# Plan: Scaffold the core/ Node package and add a dedicated node specialist agent

Issue: [190-scaffold-the-core--node-package-and-add-a-dedicated-node-specialist-agent.md](../../issues/190-scaffold-the-core--node-package-and-add-a-dedicated-node-specialist-agent.md)

## Overview

Build the `core/` Node.js package from scratch (Yarn, Jasmine/c8/JSCPD, ESLint flat config, a trivial `Greeter` class+spec to prove the toolchain, and a stub `core/bin/arcanum` entrypoint), add a Docker test image plus a Makefile/compose target to run the suite in it, and introduce two brand-new specialist agents — `node` (owns `core/`'s JS/config) and `infra` (owns Docker/Makefile/compose repo-wide) — wiring them into `AGENTS.md`, `docs/agents/folder-structure.md`, and the commit-author config.

## Context

Per #168/#189's architecture decisions (`docs/agents/architecture/script-engine.md`): a single central `core/` package at the repo root, Yarn-managed, ESM (`"type": "module"`), zero runtime npm dependencies, Jasmine+c8+JSCPD for testing, an ESLint flat config with specific style rules, `core/spec/` mirroring `core/lib/` 1:1, and a Docker test image based on `darthjee/node` that later doubles as the base for `engine.mode=docker`. This issue is pure scaffolding — no real script is migrated yet (that starts at #193); CI wiring is #191's job, not this one.

Because `node` and `infra` don't exist as agents until this issue creates them, none of the repo's currently-configured specialist agents (`scripter`, `skill-writer`, `skill-reviewer`) own any part of this work — `scripter` is bash-only, `skill-writer`/`skill-reviewer` are scoped to skill `.md` files. This is the bootstrap exception: `architect` implements the whole issue directly, including writing the two new agent definition files themselves. Once merged, `node` and `infra` become real dispatchable specialists for #191–#193 and beyond.

## Implementation Steps

### Step 1 — `core/package.json` and tooling config

Create `core/package.json`: `"type": "module"`, `engines.node` pinned to whatever Node version the `darthjee/node` Docker image bundles, Yarn as package manager (no `package-lock.json`), devDependencies for Jasmine, c8, ESLint (flat config support), and JSCPD. Add `scripts` entries: `test` (Jasmine via c8 for coverage), `lint` (ESLint), and a duplication-check script (JSCPD, informational). Configure c8 (lcov reporter, low placeholder coverage thresholds, e.g. 50%, not hard-enforced) either in `package.json` or a `.c8rc.json`, per convention in `package.json`. Add `core/eslint.config.mjs`: 2-space indent, single quotes, semicolons, `const`/`let` only, strict `===`, no `console.log`, JSDoc required on public functions. Run `yarn install` to generate and commit `core/yarn.lock`.

### Step 2 — `core/spec/` tree

Create `core/spec/support/{factories,dummies,utils,fixtures}` (empty, `.gitkeep` or similar placeholder if needed for git to track empty dirs) — no content needed yet, just the structure for future migrated entrypoints' specs to use.

### Step 3 — Trivial validation class + spec

Add `core/lib/Greeter.js` exporting a `Greeter` class with a `greet(name)` method: returns `` `Hello, ${name}!` `` when `name` is truthy, `'Hello, stranger!'` when falsy — a real branch so both lint and coverage are meaningfully exercised. Add `core/spec/lib/Greeter_spec.js` covering both branches. This class/spec pair is temporary — noted in the issue as scheduled for deletion once #193 lands a real migrated entrypoint.

### Step 4 — `core/bin/arcanum` stub

Add `core/bin/arcanum`: `#!/usr/bin/env node` shebang, no `.js` extension, executable bit set. For this issue it's a stub — proof it's wired into the package and executable, no real command routing (that's #192's job, since no `arcanum/_lib/engine_dispatch.sh` caller exists yet to invoke it).

### Step 5 — Docker test image + Makefile/compose target

Add a `Dockerfile` (likely `core/Dockerfile` or repo-root, based on `darthjee/node`) that installs dependencies via the warm Yarn cache the base image provides, without baking in `core/`'s source (bind-mounted at runtime). Add a `docker-compose*.yml` service and/or a `Makefile` target that builds the image and runs `yarn test`/`yarn lint` inside it with `core/` bind-mounted. Verification for this issue is manual: a human runs the target locally and confirms the suite passes inside the container — no CI automation yet (#191).

### Step 6 — `.claude/agents/node.md`

Add the `node` specialist agent: frontmatter `name: node`, `description` scoped to Node.js source/config under `core/` (`core/lib/`, `core/spec/`, `core/bin/`, `core/package.json`, `core/eslint.config.mjs`), `tools: Read, Edit, Write, Bash`. Follow the existing `scripter.md`/`skill-writer.md` shape (scope section, conventions, "how to coordinate with the architect" section). Explicitly note it does not edit `AGENTS.md` (architect's job) but does own `docs/agents/` updates for the parts of `core/` it builds, including the `core/` row in `docs/agents/folder-structure.md`.

### Step 7 — `.claude/agents/infra.md`

Add the new `infra` specialist agent: frontmatter `name: infra`, `description` scoped repo-wide to Docker/Makefile/compose files (not narrowly to `core/`'s test image), `tools: Read, Edit, Write, Bash`. It owns the Dockerfile/compose/Makefile target created in Step 5.

### Step 8 — Update `AGENTS.md`

Add `node` and `infra` rows to the Agents table (alongside `architect`, `scripter`, `skill-writer`, `skill-reviewer`). Update the "Stack" section's Node.js mention (currently: "`core/` does not exist in the repo yet, and every entrypoint still runs as shell until its native counterpart ships") to reflect that `core/` now exists as a real Node.js package.

### Step 9 — Update `docs/agents/folder-structure.md`

Add a `core/` row to the top-level directory table, describing it as the Node.js package holding migrated script logic (per `docs/agents/architecture/script-engine.md`), its test tooling, and pointing at the architecture doc for details. (Per the issue's decision, this specific row is `node`'s ongoing responsibility going forward, but since `node` doesn't exist until this issue lands, `architect` writes it this one time as part of the Step 1 bootstrap fallback.)

### Step 10 — Commit-author config

Add to `.claude/configuration/arcanum-repo-config.json`'s `git.agents` map: `"node": "darthjee+backend@gmail.com"` and `"infra": "darthjee+infra@gmail.com"`.

## Files to Change

- `core/package.json` — new: Yarn, ESM, Jasmine/c8/JSCPD config, `engines.node`
- `core/eslint.config.mjs` — new: flat config with the documented style rules
- `core/yarn.lock` — new: committed lockfile
- `core/spec/support/{factories,dummies,utils,fixtures}/` — new: empty scaffolding dirs
- `core/lib/Greeter.js` — new: trivial validation class (temporary, removed in #193)
- `core/spec/lib/Greeter_spec.js` — new: its spec (temporary, removed in #193)
- `core/bin/arcanum` — new: stub native entrypoint executable
- `Dockerfile` (or `core/Dockerfile`) — new: `darthjee/node`-based test image
- `docker-compose*.yml` and/or `Makefile` — new: target(s) to build/run the test image with `core/` bind-mounted
- `.claude/agents/node.md` — new: `node` specialist agent definition
- `.claude/agents/infra.md` — new: `infra` specialist agent definition
- `AGENTS.md` — Agents table rows for `node`/`infra`; Stack section updated for `core/`'s existence
- `docs/agents/folder-structure.md` — new `core/` row
- `.claude/configuration/arcanum-repo-config.json` — `git.agents.node`, `git.agents.infra` entries

## Notes

- No CI job currently runs anything under `core/` — `.circleci/config.yml` only handles the release-zip/tag workflow. Wiring `core/`'s test suite into CI is explicitly #191, not this issue, so no `## CI Checks` section applies here.
- Shipping `core/lib`/`core/bin` to consuming repos' installs (bundled into the release zip, or otherwise) is explicitly out of scope and unresolved — flagged in the issue for a later sub-issue (likely #192 or a new one), not addressed by this plan.
- Exact Docker/Makefile file locations (`core/Dockerfile` vs. repo-root `Dockerfile`, Makefile target name) are left to implementation-time judgment, consistent with how the issue documents these as `infra`'s ongoing scope rather than pinning exact paths.
- This is a one-time bootstrap exception to the usual single-owner-per-issue dispatch: `architect` implements everything here, including the two new agent files it will never own again after this issue merges.
