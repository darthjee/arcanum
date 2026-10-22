# Issue: Switch core and cli to shared/ and remove the core copy

## Description

Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent). The epic holds the full design decisions: Scope, Edge Cases, Testing Strategy, Performance and Security, Backward Compatibility.

This issue makes `core/` and `cli/` use `shared/`, then deletes the copy in `core/lib/shared/`. It closes the copy window that #822 opened.

## Problem

Since #822 the shared config surface exists twice: in `core/lib/shared/` (owned by `node`) and in `shared/lib/` (owned by `shared`). The two copies are byte-identical today. A temporary "drift rule" in the agent files keeps them that way: any unavoidable change is made in both copies in the same PR. Every consumer still imports the core copy:

- `core/lib/` and `core/bin/`: 22 imports in 18 files;
- `cli/lib/commands/config.js`, through `../../../core/lib/shared/`;
- about 40 core specs and spec-support files;
- `cli/eslint.config.mjs` and `cli/scripts/build.mjs`, whose boundary allow-lists name `core/lib/shared/`.

As long as both copies exist, they can drift apart, and `shared/` is not yet the real source of truth.

## Expected Behavior

- `core/` and `cli/` import the shared surface only from `shared/lib/`.
- `core/lib/shared/` and `core/spec/lib/shared/` no longer exist.
- Linting, the build boundary check and the runtime smoke test all enforce or prove the new layout.
- Behaviour is unchanged: dispatcher output, exit codes, the parity tests and the CLI smoke specs.

## Solution

### 1. Diff check first

Before switching, confirm that `core/lib/shared/` and `shared/lib/` are still identical (`diff -r`). If they are not, re-sync `shared/lib/` first. They were identical when this issue was refined.

### 2. Switch the imports (`node`, `client`)

Rewrite the imports as a prefix change to relative `shared/lib/` paths, e.g. `../../shared/config/X.js` → `../../../shared/lib/config/X.js`:

- `core/lib/**` and `core/bin/**`;
- core specs and spec support: `core/spec/support/**`, `core/spec/lib/**`;
- `cli/lib/commands/config.js`.

`shared/` reaches every environment without packaging changes:

- in development, through the whole-repo bind mount;
- in the runtime image, through `COPY . $ARCANUM_ROOT`;
- in the release zip.

`.dockerignore` and the zip `EXCLUDES` list already drop only `shared/spec/` and `shared/eslint.config.mjs`.

### 3. Delete the core copy (`node`)

- Delete `core/lib/shared/`, with no re-export shims.
- Delete `core/spec/lib/shared/`. Each of its specs already has a counterpart in `shared/spec/`.
- Cross-cutting and interop specs (e.g. `ShellConfigKeyScan_spec.js`, `KeyRegistryDefaults_spec.js`, `agentEmailParity_spec.js`) stay in core and import from `shared/lib/`.

### 4. Lint and build boundaries

- `core/eslint.config.mjs` (`node`): drop the `lib/shared/**` folder rule; `shared/eslint.config.mjs` now enforces it. Add a rule that `core/` may import `shared/lib/**` but never `shared/spec/**`.
- `cli/eslint.config.mjs` (`client`): replace the `core/(?!lib/shared/)` restriction. `cli/` may not import `core/` at all, and may import `shared/lib/**` but never `shared/spec/**`. Update `cli/spec/packaging/eslintBoundary_spec.js` to match.
- `cli/scripts/build.mjs` (`client`): `ALLOWED_INPUT_DIRS` becomes `['cli/lib/', 'shared/lib/']`. Update its header comment and `cli/spec/scripts/build_spec.js`.

### 5. Repoint path references in comments and messages

- Code comments that name `core/lib/shared/...`: `arcanum/_lib/lock.sh`, `core/lib/utils/config/NamespacedBooleanKeyConfig.js`, `core/lib/commands/shared/PermissionGrant.js`, `core/lib/commands/auto-fix-all/AutoFixAllQueue.js`, `core/spec/support/strictConfigKeys.js`, `core/spec/support/fixtures/agentEmailFixtures.js`, and `core/spec/bin/agentEmailParity_spec.js`. Each goes to its owner.
- The strict-key error message in `shared/lib/config/KeyRegistry.js` (`... is not in core/lib/shared/config/keys.json ...`) becomes `shared/lib/config/keys.json`, with its two `shared/spec/config/KeyRegistry_spec.js` expectations (`shared`).

### 6. Runtime smoke (`infra`)

Extend `make core-smoke-runtime` to run one native config command inside the runtime image, so a runtime image that cannot resolve `shared/` fails in CI. Proposed: `arcanum-check-config git.authors`, asserting exit 0 and that the output shows the resolved-value line.

### 7. Agent files and docs (`architect`)

- Remove the copy-window drift rule from `.claude/agents/node.md`, `client.md` and `shared.md`.
- Drop the remaining `core/lib/shared/` mentions from the agent scopes.
- Update the `shared/` row in `docs/agents/folder-structure.md`.

### Owners

- `node`: core.
- `client`: cli.
- `shared`: the error message in `KeyRegistry.js`.
- `infra`: the smoke-runtime target.
- `architect`: the agent files and docs.

### Out of scope

- JSCPD for `shared/` (#833).
- Any later reorganisation of `shared/` (#825–#827).
- Changing the surface's behaviour.

### Dependencies

Starts after #822 (scaffold and copy), which is merged. It can run in parallel with #823 (dev container and CI for `shared/`); it does not need #823 to merge first.

## Benefits

- One source of truth for the shared surface; the drift rule disappears.
- `cli/` no longer reaches into `core/` at all.
- The runtime smoke test catches an image that cannot resolve `shared/`.
