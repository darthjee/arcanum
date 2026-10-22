# Issue: Promote the shared lib spec into architecture docs

## Description

Part of epic #816 (extract the shared config logic into a root `shared/` lib with its own agent). This is item 9 of #816. The design is in [`docs/agents/specs/shared-lib.md`](docs/agents/specs/shared-lib.md), which wins over the epic body.

Items 1–8 are merged (#818–#825). `shared/lib/{config,file}/` now holds the config surface, `core/` and `cli/` import it by relative path, and `RepoConfigWriter` has the #825 additions. This issue turns the spec into a permanent architecture doc that describes what was built, the same way #785 does for the CLI. It also brings every other doc in line with the new layout.

## Problem

- The `shared/` design exists only in a spec, which #827 will delete. Once it is gone, nothing permanent will describe the layout, the import boundary, the ownership rules or the packaging.
- The `arcanum-cli` specs still carry "Suspended" banners on the sections #816 reversed. Each banner says "Until #826 rewrites it, `shared-lib.md` wins".
- Several docs still name paths that no longer exist, `core/lib/utils/config/*` and `core/lib/utils/file/{Lock,LockTimeoutError,RepoPath}.js`, or still say `node` owns the surface:
  - `docs/agents/architecture/lock-system.md`, `docker-engine.md` and `shared-state-and-configuration.md`;
  - `docs/agents/specs/arcanum-cli.md`, `arcanum-cli/shared-config-logic.md`, `key-registry.md`, `command-surface.md` and `shortcuts-and-setup.md`.
- Docs and agent files link to `docs/agents/specs/shared-lib.md` as the source of truth. Those links will break when #827 removes the spec.

## Expected Behavior

- A new `docs/agents/architecture/shared-lib.md` describes `shared/` as built and stands on its own.
- No doc names a moved file at its old `core/lib/utils/...` or `core/lib/shared/...` path, or says `node` owns the surface.
- No "Suspended … until #826" banner is left anywhere.
- Every doc and agent-file link to the spec points at the architecture doc instead. Code comments are the exception (see Out of scope).
- `docs/agents/architecture.md` lists the new doc.
- The spec files stay in place; #827 removes them.

## Solution

1. **New `docs/agents/architecture/shared-lib.md`.** It describes what was built, drawn from the spec. It covers:
   - **Purpose:** code shared by `core/` and `cli/`; new code both consumers need goes here, not into `core/lib`.
   - **Layout:** the files in `shared/lib/{config,file}/` and `shared/spec/`, and the files that stay in core (`BooleanKeyConfig`, `NamespacedBooleanKeyConfig`, `DispatchFailure`, `InstallRoot`, …).
   - **Import boundary:** `node:` built-ins and `shared/lib/` only, no dynamic `import()`; consumers import by relative path and never import `shared/spec/`; the ESLint rules that enforce this.
   - **Ownership:** `shared` owns the folder, and the `keys.json` exception.
   - **Packaging and runtime:** it ships in the zip and the runtime image, specs are excluded, the packaging specs guard both, and the runtime smoke check covers it.
   - **Tooling and CI:** the dev-container service, the `shared-*` Makefile targets, the CircleCI job, the Node floor, enforced coverage, and the non-blocking Codacy and `yarn audit` steps.
   - **Writer API:** `write` (with an optional namespace), `setVersion` and `unset`, with `timeoutMs` and their no-op and error semantics from #825.
   - **Security:** zero runtime dependencies, enforced by a spec.
   - **Alternatives considered:** kept short.

   The migration history is left out: the steps, the spec-file inventory, the copy window and the implementation order. It stays in #816 and the merged PRs.
2. **`docs/agents/architecture.md` index:** add a row for the new doc. Also add `shared/` to the `AGENTS.md` architecture-hub summary line if it lists topics.
3. **`arcanum-cli` specs** (still specs until #785/#786):
   - Rewrite the suspended sections in place to match `shared/`, and drop their banners:
     - `shared-config-logic.md`: "Source stays in core", the build-time surface check in "Bundle at build time with `esbuild`", "Shared-surface lint rule", and "Future work". Reverse the "Extracting a shared workspace package now — rejected" alternative into "done in #816" and remove that entry from Future work.
     - `key-registry.md`: Location (`shared/lib/config/keys.json`, owned by `shared`, with the exception).
     - `packaging-and-release.md`: the bundled-surface bullet.
     - `arcanum-cli.md`: the `node` row, and the `keys.json` path and owner in its parts list.
   - Repoint the plain `core/lib/utils/...` mentions in `arcanum-cli.md`, `command-surface.md` and `shortcuts-and-setup.md`.
4. **Architecture docs:** repoint `lock-system.md` and `docker-engine.md` (`Lock.js`) and `shared-state-and-configuration.md` (`keys.json`, `KeyRegistry.js`, and the checklist entry).
5. **Spec links in docs and agent files:** repoint them to `architecture/shared-lib.md`, with anchors where they exist. This covers:
   - `agent-roster-and-delegation.md`, `folder-structure.md`, `.claude/agents/shared.md` and `.claude/agents/node.md`;
   - the `arcanum-cli` spec cross-links.

   Remove the `shared.md` line "Until #826 promotes it …" and say the design lives in the architecture doc.
6. **Spec status:** mark the Shared Lib spec "Implemented" in `docs/agents/specs.md`. In the spec's own Status section, say it was promoted to `architecture/shared-lib.md` and is pending removal in #827.

## Out of scope

- Code comments and messages that link to the spec. These are in `core/eslint.config.mjs`, `cli/eslint.config.mjs`, `shared/eslint.config.mjs` and `shared/README.md`, which other agents own. #827 repoints them when it removes the spec.
- Removing the spec (#827).
- Promoting the CLI spec (#785).
- The old paths used as fixtures in `cli/spec/scripts/build_spec.js` and `cli/spec/packaging/eslintBoundary_spec.js`.

## Owner

`architect` (docs and agent files only).

## Dependencies

After items 7 (#824) and 8 (#825) of #816. Both are merged.

## Benefits

- `shared/` keeps a permanent, accurate design doc after #827 deletes the spec.
- No doc points at a path that no longer exists or names the wrong owner.
- #827 shrinks to deleting the spec and fixing a few code-comment links.
