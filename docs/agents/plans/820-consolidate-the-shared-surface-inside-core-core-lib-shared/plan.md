# Plan: Consolidate the shared surface inside core (core/lib/shared/)

Issue: [820-consolidate-the-shared-surface-inside-core-core-lib-shared.md](../../issues/820-consolidate-the-shared-surface-inside-core-core-lib-shared.md)

## Overview

Move the 10 shared-surface paths from `core/lib/utils/{config,file}/` into `core/lib/shared/{config,file}/`, with their unit specs, and turn the surface boundary into a folder rule on both sides: core's ESLint block covers `lib/shared/**`, and `cli/`'s ESLint restriction and build metafile check accept anything under `core/lib/shared/`. Code comments and agent files are repointed to the new paths; behaviour stays the same. This is step 1 of the [Shared Lib spec](../../specs/shared-lib.md#migration-steps).

## Agents involved

- [node](node.md) — move the files and specs, rewrite core imports, core's folder lint rule.
- [client](client.md) — rewrite cli imports, folder-based lint restriction and build check.
- [scripter](scripter.md) — repoint the `arcanum/_lib/lock.sh` comment.
- [architect](architect.md) — repoint agent files, update the spec.

`node` goes first: `client`'s imports and `build_spec.js` resolve against the moved files. `scripter` and `architect` are independent.

## Shared contracts

**The moved paths** (old → new, via `git mv`; no re-export shims, no copies left behind):

| Old | New |
| --- | --- |
| `core/lib/utils/config/ConfigChain.js` | `core/lib/shared/config/ConfigChain.js` |
| `core/lib/utils/config/RepoConfig.js` | `core/lib/shared/config/RepoConfig.js` |
| `core/lib/utils/config/RepoConfigWriter.js` | `core/lib/shared/config/RepoConfigWriter.js` |
| `core/lib/utils/config/ConfigError.js` | `core/lib/shared/config/ConfigError.js` |
| `core/lib/utils/config/AgentEmail.js` | `core/lib/shared/config/AgentEmail.js` |
| `core/lib/utils/config/KeyRegistry.js` | `core/lib/shared/config/KeyRegistry.js` |
| `core/lib/utils/config/keys.json` | `core/lib/shared/config/keys.json` |
| `core/lib/utils/file/Lock.js` | `core/lib/shared/file/Lock.js` |
| `core/lib/utils/file/LockTimeoutError.js` | `core/lib/shared/file/LockTimeoutError.js` |
| `core/lib/utils/file/RepoPath.js` | `core/lib/shared/file/RepoPath.js` |

Everything else in `core/lib/utils/` (`BooleanKeyConfig`, `NamespacedBooleanKeyConfig`, `InstallRoot`, `InstallVersion`, `IssueFileLocator`, `IssueStatePaths`) stays.

**The boundary** (both sides key on the same folder):

- core: files under `core/lib/shared/**` import only `node:` built-ins and relative paths that resolve inside `core/lib/shared/`; no dynamic `import()`.
- cli: `cli/` may import any path under `core/lib/shared/`, and nothing else under `core/`; the build fails on any bundled input outside `cli/lib/**` and `core/lib/shared/**`. The build no longer reads core's ESLint config.

**The one message change:** `KeyRegistry`'s strict-mode error (`... is not in core/lib/utils/config/keys.json (ARCANUM_STRICT_CONFIG_KEYS=1)`) names the file's path; it becomes `core/lib/shared/config/keys.json`. Only reachable under `ARCANUM_STRICT_CONFIG_KEYS=1`, i.e. specs. All other output, exit codes and parity specs stay byte-identical.

## CI Checks

- `core`: `make core-lint` / `make core-test` (`cd core && yarn lint && yarn test`) (CI jobs: `checks`, `test`)
- `cli`: `cd cli && yarn lint && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes

- `core/lib/commands/shared/` already exists (shared *command* helpers) and is unrelated; `core/lib/shared/` is a sibling of `commands/`, not inside it.
- `cli/dist/` is not tracked, so no bundle needs regenerating in the PR.
- Architecture docs (`lock-system.md`, `docker-engine.md`, `shared-state-and-configuration.md`) and the `arcanum-cli` specs keep the old paths until #826.
