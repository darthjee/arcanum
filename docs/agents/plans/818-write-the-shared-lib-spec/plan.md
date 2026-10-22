# Plan: Write the shared lib spec

Issue: [818-write-the-shared-lib-spec.md](../../issues/818-write-the-shared-lib-spec.md)

## Overview

Write `docs/agents/specs/shared-lib.md`, the design spec for epic #816 (extracting the shared config logic into a root `shared/` lib owned by a new `shared` agent). Register it in the specs index, and mark the sections of the `arcanum-cli` specs that #816 reverses as "Suspended". Docs only; no code changes.

## Context

- Epic #816's body holds every decision. This spec turns them into the contract for #819–#827 and, from its merge on, supersedes the epic body. Only #816's split list may still change.
- The house style for specs is `docs/agents/specs/arcanum-cli.md` and `docs/agents/specs/shell-engine-removal.md`. The specs index is `docs/agents/specs.md`, and `AGENTS.md` (§ Specs) requires an index entry for every new spec.
- The surface being moved is 9 files plus `keys.json`:
  - `core/lib/utils/config/`: `ConfigChain.js`, `RepoConfig.js`, `RepoConfigWriter.js`, `ConfigError.js`, `AgentEmail.js`, `KeyRegistry.js`, `keys.json`;
  - `core/lib/utils/file/`: `Lock.js`, `LockTimeoutError.js`, `RepoPath.js`.

  It is declared today by the shared-surface `files` list in `core/eslint.config.mjs`. About 37 files in `core/spec` and `cli/spec` import it.
- Architect-owned: the spec, the specs index, and the banners in the existing specs.

## Steps

- [01 — Write the shared lib spec](plan/01-write-the-spec.md)
- [02 — Register the spec in the specs index](plan/02-register-in-specs-index.md)
- [03 — Mark the reversed arcanum-cli spec sections as suspended](plan/03-mark-cli-specs-suspended.md)

## Notes

- **Size rule:** if `shared-lib.md` exceeds about 500 lines, split it into `shared-lib.md` (index) plus `shared-lib/migration-steps.md`, `shared-lib/writer-api.md` and `shared-lib/tooling-and-ci.md`. Then create one "Enhance spec: …" sub-issue of #816 per part, in a follow-up. Do not create them in this PR.
- **No CI job covers `docs/` content,** so there are no CI checks to run. Check relative links by hand, especially the banner links from `docs/agents/specs/arcanum-cli/*.md` (`../shared-lib.md`) and from `docs/agents/specs/arcanum-cli.md` (`shared-lib.md`).
- **The spec-file inventory is the biggest piece of work.** Derive it from the actual import graph (grep `core/spec` and `cli/spec` for imports of the 10 surface paths), not from memory.
