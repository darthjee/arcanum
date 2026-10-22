# Issue: Consolidate the shared surface inside core (core/lib/shared/)

## Description

Part of epic #816 (extract the shared config logic into a `shared/` lib with its own agent), item 3. The design lives in the [Shared Lib spec](docs/agents/specs/shared-lib.md) (Migration steps, step 1, and the Spec-file inventory).

Gather the shared config surface into one folder inside core, `core/lib/shared/`, so the later copy (#822) and switch (#824) are a plain prefix change (`core/lib/shared/` → `shared/lib/`). Behaviour does not change.

## Problem

The surface — `ConfigChain`, `RepoConfig`, `RepoConfigWriter`, `ConfigError`, `AgentEmail`, `KeyRegistry`, `keys.json`, `Lock`, `LockTimeoutError`, `RepoPath` — is spread across `core/lib/utils/config/` and `core/lib/utils/file/`, mixed with core-only files (`BooleanKeyConfig`, `NamespacedBooleanKeyConfig`, `InstallRoot`, `InstallVersion`, `IssueFileLocator`, `IssueStatePaths`). Its boundary is a hand-kept 9-file allowlist in `core/eslint.config.mjs`, mirrored by a 7-entry-file regex in `cli/eslint.config.mjs`, and `cli/scripts/build.mjs` reads that file list back out of core's ESLint config to check the bundle. Extracting it from there means touching every one of these lists file by file.

## Expected Behavior

- The 10 surface paths live under `core/lib/shared/{config,file}/`; the core-only files stay in `core/lib/utils/`.
- The boundary is a folder: anything under `core/lib/shared/**` may import only `node:` built-ins and files in that folder, with no dynamic `import()`.
- `cli/` reaches core only through `core/lib/shared/`, enforced by its lint rule and the build's metafile check.
- Dispatcher output, exit codes and the shell/native parity specs are byte-identical before and after.

## Solution

### Move the surface (`node`)

- `git mv` the 10 files: `core/lib/utils/config/{ConfigChain,RepoConfig,RepoConfigWriter,ConfigError,AgentEmail,KeyRegistry}.js` and `keys.json` → `core/lib/shared/config/`; `core/lib/utils/file/{Lock,LockTimeoutError,RepoPath}.js` → `core/lib/shared/file/`.
- Rewrite every import in `core/lib/`, `core/bin/` and `core/spec/` (including support files). No re-export shims.

### Move the unit specs (`node`)

Follow the spec's Spec-file inventory, without re-deriving it:

- **moved** specs go to `core/spec/lib/shared/{config,file}/`;
- `Lock_spec.js` (listed as **duplicated**) moves **whole** to `core/spec/lib/shared/file/Lock_spec.js`, unchanged, so specs keep mirroring `lib/` 1:1. Its split into a unit half and a core-only `lock.sh` race half is #822's job;
- **stays in core** specs (`KeyRegistryDefaults_spec.js`, `ShellConfigKeyScan_spec.js`, `BooleanKeyConfig_spec.js`, `NamespacedBooleanKeyConfig_spec.js`, `agentEmailParity_spec.js`, `support/utils/shellConfigKeys.js`, `support/strictConfigKeys.js`) keep their place and only get new import paths.

### Folder lint rule (`node`)

Replace the 9-file `files` block in `core/eslint.config.mjs` with a block on `lib/shared/**/*.js`: imports allowed only for `node:` built-ins and relative paths that stay inside `lib/shared/` (including `./keys.json`); `ImportExpression` stays banned.

### CLI side (`client`)

The boundary becomes the folder on the CLI side too — the same shape #824 needs for `shared/`:

- Rewrite `cli/lib/` and `cli/spec/` imports to `core/lib/shared/...`.
- `cli/eslint.config.mjs`: replace the 7-entry-file regex with a folder rule — `cli/` may import anything under `core/lib/shared/`, and nothing else under `core/`.
- `cli/scripts/build.mjs`: the metafile check accepts any bundled input under `cli/lib/**` or `core/lib/shared/**` (which covers `keys.json`), and fails on anything else. It no longer parses core's ESLint config, so `sharedSurface()` and its `files`-list extraction go away.
- Update `cli/spec/scripts/build_spec.js` and `cli/spec/packaging/eslintBoundary_spec.js` to match.

### Path references

- Code comments naming the moved files are repointed to `core/lib/shared/...` now, so none points at a deleted path; #824 repoints them again to `shared/lib/`:
  - `arcanum/_lib/lock.sh` (the "shared byte-for-byte with `Lock.js`" comment) — `scripter`;
  - comments in `core/` — `node`; in `cli/` (e.g. `build.mjs`, `eslint.config.mjs`) — `client`.
- Agent files (`architect`): `node.md`, `scripter.md` and `client.md` name `core/lib/utils/config/keys.json`; repoint them to `core/lib/shared/config/keys.json` and keep the "moves to `shared/lib/` in #824" note.
- Spec (`architect`): update the [Shared Lib spec](docs/agents/specs/shared-lib.md) to match these decisions — step 1 now repoints code comments and uses the folder boundary on the CLI side; the Implementation order note no longer defers code comments wholly to #824; the inventory notes that `Lock_spec.js` moves whole in #820.
- Architecture docs (`lock-system.md`, `docker-engine.md`, `shared-state-and-configuration.md`) and the `arcanum-cli` specs are left for #826, per the spec.

### Out of scope

- Creating `shared/` (#822) and switching to it (#824).
- Splitting `Lock_spec.js` (#822).
- Any change in what the surface does.

## Benefits

- #822 copies one folder and #824 changes one prefix, on both the core and the CLI side.
- The surface boundary is a folder everywhere, so adding a surface file no longer means editing three lists.
- No comment points at a deleted path between #820 and #824.
- The surface and core-only utils are visibly separate.
