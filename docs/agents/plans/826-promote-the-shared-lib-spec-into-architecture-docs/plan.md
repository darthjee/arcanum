# Plan: Promote the shared lib spec into architecture docs

Issue: [826-promote-the-shared-lib-spec-into-architecture-docs.md](../../issues/826-promote-the-shared-lib-spec-into-architecture-docs.md)

## Overview

Docs only. Add a permanent `docs/agents/architecture/shared-lib.md` that describes `shared/` as built, and list it in the architecture hub. Rewrite the suspended `arcanum-cli` spec sections. Repoint every stale `core/lib/utils/...` path, and every doc or agent-file link to `specs/shared-lib.md`. Mark the spec Implemented. No code changes.

## Context

- Item 9 of #816. Items 1–8 (#818–#825) are merged: the surface is in `shared/lib/{config,file}/`, `core/` and `cli/` import it by relative path, and `RepoConfigWriter` has `unset`, `timeoutMs` and the top-level write (#825).
- The spec `docs/agents/specs/shared-lib.md` is the source. Its own Implementation order section gives #826 the suspended `arcanum-cli` sections, the plain `core/lib/...` mentions in the `arcanum-cli` specs, and the three architecture docs.
- The moved files are: `ConfigChain`, `RepoConfig`, `RepoConfigWriter`, `ConfigError`, `AgentEmail`, `KeyRegistry` and `keys.json` (to `shared/lib/config/`), and `Lock`, `LockTimeoutError` and `RepoPath` (to `shared/lib/file/`).
- Core keeps `core/lib/utils/config/{BooleanKeyConfig,NamespacedBooleanKeyConfig}.js` and `core/lib/utils/file/{InstallRoot,InstallVersion,IssueFileLocator,IssueStatePaths}.js`. Do not repoint mentions of those (e.g. `InstallRoot.js` in `docker-engine.md`).
- No candidate specialist owns `docs/` or `.claude/agents/`, and `architect` is the coordinator, so the plan has no specialist owner; `architect` carries it out.

## Steps

- [01 — Write the architecture doc](plan/01-architecture-doc.md)
- [02 — Index it](plan/02-index.md)
- [03 — Rewrite the arcanum-cli specs](plan/03-arcanum-cli-specs.md)
- [04 — Repoint the architecture docs](plan/04-architecture-docs.md)
- [05 — Repoint spec links and mark the spec Implemented](plan/05-links-and-status.md)

## Notes

- No CI job lints markdown. Keep the repo's `.markdownlint.json` rules (MD024 siblings only; MD060 compact tables) anyway, since Codacy reads them.
- Final check: `grep -rnE "core/lib/(utils/(config/(ConfigChain|RepoConfig|RepoConfigWriter|ConfigError|AgentEmail|KeyRegistry|keys)|file/(Lock|LockTimeoutError|RepoPath))|shared/)" docs .claude AGENTS.md` should match only `docs/agents/specs/shared-lib.md` (left in place for #827) and `docs/agents/issues/`/`docs/agents/plans/` history.
- `grep -rn "specs/shared-lib" docs .claude AGENTS.md` should match only `specs.md` (the index entry stays until #827) and the spec itself.
- `grep -rn "Suspended" docs/agents/specs` should not match any "#826" banner.
- Out of scope:
  - code comments and messages that link to the spec (`core/`, `cli/` and `shared/` ESLint configs, `shared/README.md`), which #827 handles;
  - the fixture paths in `cli/spec/scripts/build_spec.js` and `cli/spec/packaging/eslintBoundary_spec.js`;
  - deleting the spec (#827);
  - promoting the CLI spec (#785).
- Write in the style of the existing architecture docs (e.g. `docker-engine.md`): present tense, describing what exists, with issue numbers only where they explain a guard.
