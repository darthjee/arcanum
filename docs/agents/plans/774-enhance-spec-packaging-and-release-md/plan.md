# Plan: Enhance spec: packaging-and-release.md

Issue: [774-enhance-spec-packaging-and-release-md.md](../../issues/774-enhance-spec-packaging-and-release-md.md)

## Overview

Docs-only deepening of `docs/agents/specs/arcanum-cli/packaging-and-release.md` (epic #767), owned by `architect`. No specialist agent has work: no code, scripts, skills, CI or Docker files change.

## Context

The file currently lists four open points (npm `--provenance`, npm-publish failure after a successful GitHub release, the `engines.node` floor, pre-release dist-tags) and has no edge-case, backward-compatibility, testing, performance or security coverage. The index (`docs/agents/specs/arcanum-cli.md`) already promises this file covers the embedded migration-version list, the runtime-check entrypoint and the Node 22.13 CI job, which it does not yet detail. Relevant facts found while exploring:

- `core/package.json` declares `engines.node: ">=22.13.0"`; the index already fixes the CLI floor at that value, in lockstep.
- The CircleCI `release` workflow only triggers on bare `X.Y.Z` tags (`/^\d+\.\d+\.\d+$/`); there are no pre-release tags.
- `publish-image` already sets the precedent of immutable published versions (fails if the tag exists, including on re-runs) and secrets passed as project env vars.
- `scripts/bump-version.sh` updates `arcanum.version`, the bootstrap default, README and rolls `arcanum/migrations/repos/next/` into `<version>/`; it does not know about `cli/package.json` yet.
- Migration lists live in `arcanum/migrations/repos/<version>/migrations.json`, each entry carrying `applies_to: repo|local|global`; `next/` holds unreleased migrations.

## Implementation Steps

### Step 1 — Rewrite `packaging-and-release.md`

Deepen every decision section and resolve the open points:

- **Layout / `package.json`:** full field list (`name`, `version` in lockstep, `type: module`, `bin`, `files`, `engines.node: ">=22.13.0"`, `scripts`, `publishConfig` with `access: public` and `provenance: true`, `repository`/`license`/`homepage` needed for provenance), zero runtime deps, pinned devDependencies with a committed `yarn.lock`.
- **Build output:** single `dist/arcanum.mjs`; the embedded per-scope migration-version list (built from released `repos/<X.Y.Z>/migrations.json` dirs only, `next/` excluded, sorted by semver, scoped by `applies_to`); version injected via `define`; `bin/arcanum` gate.
- **Release:** publish job in the `release` workflow (owned by `infra`), `requires: [build-and-release]`, parallel to `publish-image`; asserts `cli/package.json` version equals `$CIRCLE_TAG`; `yarn install --frozen-lockfile`, lint, build, specs, then `npm publish --provenance`.
- **Lockstep:** `bump-version.sh` also bumps `cli/package.json`'s version (owner of the script change named); the tag check is the guard.
- **Token storage:** `NPM_TOKEN` as a CircleCI project/context env var, a granular automation token scoped to `arcanum-cli` publish only, written to a temp `.npmrc` via `${NPM_TOKEN}` interpolation, never echoed; 2FA-on-publish compatible automation token.
- **Provenance:** decide on `--provenance`, noting CircleCI OIDC support requirements; if unsupported on the chosen setup, fall back to publishing without it plus `npm pack` checksum in the GitHub release — record exact decision and fallback.
- **Failure handling:** publish after GitHub release; immutability guard (`npm view arcanum-cli@<v>` exists → succeed as no-op on re-run vs fail — decide, consistent with npm's own immutability); a failed publish is re-run from CircleCI; never `npm unpublish`; a broken published version is fixed with a new patch release plus `npm deprecate`.
- **Dist-tags:** only bare `X.Y.Z` tags release, so always `latest`; pre-releases are out of scope (record as future work).
- **Supply chain:** zero runtime deps, frozen lockfile, unminified bundle, `files` whitelist, `npm pack --dry-run` content check, provenance, no install scripts (`preinstall`/`postinstall` forbidden).
- Add **Edge cases**, **Backward compatibility**, **Testing strategy**, **Performance**, **Security** sections, and replace **Open points** with "None left" plus future work.

### Step 2 — Sync cross-links

- Update the index's Ownership "Pieces" table with new pieces introduced (npm publish job, `bump-version.sh` lockstep, tag/version check), and its Parts line for this file.
- Check `shared-config-logic.md`'s references to this file (`#release` anchor) still resolve; adjust wording if the release section changes.
- Point the index's Runtime section at the resolved `engines.node` decision.

## Files to Change

- `docs/agents/specs/arcanum-cli/packaging-and-release.md` — the rewrite.
- `docs/agents/specs/arcanum-cli.md` — ownership pieces, Parts summary, cross-links.
- `docs/agents/specs/arcanum-cli/shared-config-logic.md` — only if an anchor/wording it links to changes.

## Notes

- Docs only; the CI jobs, `bump-version.sh` change and `cli/` folder are implemented in later sub-issues by `infra`, `scripter`/owner of `scripts/`, and `client`.
- Keep the shipped `#release` anchor stable, since `shared-config-logic.md` links to it twice.
