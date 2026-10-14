# Write packaging-and-release.md

Create `docs/agents/specs/arcanum-cli/packaging-and-release.md`, restating #767's "Installation and distribution" and "Code location and ownership" decisions.

Decisions to capture:

- Code lives in a new root folder `cli/`, owned by the `client` agent: `cli/bin/arcanum`, `cli/lib/`, `cli/spec/` (Jasmine, mirroring `cli/lib/` 1:1, c8 coverage), `cli/package.json`, `cli/eslint.config.mjs`, `cli/README.md` (also the npm package page). Stack mirrors `core/` (Node ESM, Yarn, ESLint style).
- `cli/package.json`: `name: arcanum-cli`, `bin: {"arcanum": ...}`, `files` whitelist, `engines.node`, zero runtime dependencies; devDependencies for Jasmine, c8, ESLint, `esbuild`.
- Build output: one bundled file (see `shared-config-logic.md`).
- Install: `npm i -g arcanum-cli`; npm handles PATH, update, uninstall. Optional — no per-repo migration.
- Release: published from the existing CircleCI release pipeline on the same semver tag, version in lockstep with arcanum; the job and npm token setup are owned by `infra` (`.circleci/` added to its scope). The token is a CircleCI secret and never printed.
- Docker/docker-compose/Makefile `cli-*` targets for running CLI specs are owned by `infra`.

Alternatives considered: a release-zip tarball with its own `curl | bash` bootstrap (we'd own PATH/update/uninstall); a standalone binary via `bun build --compile` / `pkg` (per-OS builds, heavier CI); shipping the CLI inside each arcanum install plus a PATH migration (competing clients for multi-install users).

Open points: npm provenance; failure handling when npm publish fails after the GitHub release succeeded; minimum Node version in `engines`; whether pre-release tags publish under an npm dist-tag.

## Files to Change
- `docs/agents/specs/arcanum-cli/packaging-and-release.md` — new part.
