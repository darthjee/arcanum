# Shared Lib

`shared/` is a root folder that holds the code shared by `core/` and `cli/`. It was extracted out of `core/lib` by epic #816.

## Purpose

`shared/` holds code that both consumers need. Its first content is the config surface that the CLI bundles: the config chain, the repo config reader and writer, the key registry, the lock and the repo-path helper. New code that both `core/` and `cli/` need goes into `shared/`, not into `core/lib`.

Non-goals:

- `shared/` is never published to npm and has no runtime dependency.
- The shell `arcanum/_lib/*config*.sh` helpers are not part of it.
- The CLI-only behaviours stay in `cli/`: the malformed-file refusal, `--claude-config-dir` handling and exit-code mapping.

## Layout

The layout is flat, with no `utils/` level. Core's `utils/` only means something inside core's `commands → context/services → utils` layering, and `shared/` has no such layering.

```text
shared/
  lib/
    config/   ConfigChain.js, RepoConfig.js, RepoConfigWriter.js, ConfigError.js, AgentEmail.js, KeyRegistry.js, keys.json
    file/     Lock.js, LockTimeoutError.js, RepoPath.js
  spec/
    config/     <Name>_spec.js, mirroring lib/config/ 1:1
    file/       <Name>_spec.js, mirroring lib/file/ 1:1
    packaging/  package_spec.js (zero dependencies), eslintBoundary_spec.js (the import boundary)
    support/    factories/, fixtures/, utils/ and jasmine.json, used only by these specs
  package.json, yarn.lock, eslint.config.mjs, README.md
```

Spec support is copied, never imported across folders: `shared/spec` never imports from `core/spec`, and `core/spec` never imports from `shared/spec`. `shared/spec/support/factories/repoContextFactory.js` is a reduced copy of core's: a plain `{ repoPath }` stub, since `ConfigChain` and `RepoConfig` only read `repoContext.repoPath`.

**What stays in core:**

- `core/lib/utils/config/BooleanKeyConfig.js`, `NamespacedBooleanKeyConfig.js` and `core/lib/utils/errors/DispatchFailure.js`: the native `config.sh` dispatch layer, which only core uses.
- `core/lib/utils/file/InstallRoot.js`, `InstallVersion.js`, `IssueFileLocator.js` and `IssueStatePaths.js`: core-only helpers. `InstallRoot` resolves the install root from its own location inside `core/`.

## Import boundary

`core/` and `cli/` import `shared/` by relative path, e.g. `../../../shared/lib/config/ConfigChain.js`. `shared/` is not a package dependency of either. Node's `package.json` `imports` field cannot point outside its own package, so relative paths are the only option with no dependency and no build step.

**Everything under `shared/lib` is public.** The folder itself is the surface, so there is no allowlist of entry files.

The boundary runs both ways:

| Side | Rule | Enforced by |
| --- | --- | --- |
| `shared/lib/**` | Imports only `node:` built-ins and files under `shared/lib/`. No dynamic `import()`. Bare built-ins (`'fs'`) are rejected. | `shared/eslint.config.mjs`: `no-restricted-imports` (an allowlist regex) and `no-restricted-syntax` on `ImportExpression`, covered by `shared/spec/packaging/eslintBoundary_spec.js` |
| `core/**` | May import `shared/lib/**`, never `shared/spec/**`. | `core/eslint.config.mjs`: `SHARED_SPEC_BAN`, repeated in every block that sets `no-restricted-imports` |
| `cli/**` | May import `shared/lib/**`, never `shared/spec/**`, and nothing from `core/`. | `cli/eslint.config.mjs`: the shared-surface guardrail block |
| CLI bundle | Every bundled input lies under `cli/lib/**` or `shared/lib/**`. | `cli/scripts/build.mjs`: `ALLOWED_INPUT_DIRS` and `checkInputs` on esbuild's metafile |

Lint rules match the import specifier, not the resolved path. The build's metafile check covers resolved paths for the bundle.

**Reserved skill name.** The install root is the skills dir, so `shared/` lands at `<skills>/shared/`. Claude Code ignores it because it has no `SKILL.md`, as with `core/` and `arcanum/`, but `shared` cannot be used as a skill name (see [folder structure](../folder-structure.md)).

## Ownership

| Agent | Owns |
| --- | --- |
| `shared` | All of `shared/`: `shared/lib/`, `shared/spec/`, `shared/package.json`, `shared/yarn.lock`, `shared/eslint.config.mjs` and `shared/README.md`. It never edits `core/` or `cli/`. |
| `node` | `core/`'s Node.js source and config. It requests changes to `shared/` through `architect`. |
| `client` | All of `cli/`. It requests changes to `shared/` through `architect`. |
| `infra` | The `shared` compose service, the `shared-*` Makefile targets, the CircleCI `shared` jobs and the packaging specs. |
| `architect` | This doc, `AGENTS.md`, the agent roster and `docs/agents/folder-structure.md`. |

A PR that changes the surface keeps core's parity specs and the CLI specs green in the same PR, with the plan split across `shared` and the owners of the consumers it affects.

**The `keys.json` exception.** `shared` owns `keys.json`, its loader `KeyRegistry.js` and its schema. Any agent may still add, edit or remove an entry for a config key that its own change introduces, so adding a key never needs a separate `shared` dispatch.

See [Agent Roster and Delegation](agent-roster-and-delegation.md).

## Packaging and runtime

- **Development.** The dev container's whole-repo bind mount exposes `shared/` next to `core/` and `cli/`.
- **Release zip.** `scripts/build_release_zip.sh` packages every git-tracked file except its `EXCLUDES`, so `shared/lib/`, `shared/package.json` and `shared/yarn.lock` ship. `shared/spec/` and `shared/eslint.config.mjs` are in `EXCLUDES`.
- **Runtime image.** The `runtime` target does `COPY . /opt/arcanum`, filtered by the root `.dockerignore`, which mirrors `EXCLUDES`. `/opt/arcanum/shared/` sits next to `/opt/arcanum/core/`, so the relative imports resolve.
- **Specs are not shipped (#821).** `core/spec/` and `shared/spec/` are in `EXCLUDES` and in `.dockerignore`.
- **Packaging specs.** `core/spec/release/buildReleaseZipList_spec.js` asserts that `build_release_zip.sh --list` includes files under `shared/lib/`, and that no listed path is under a `spec/` folder.
- **Runtime smoke check.** `make core-smoke-runtime` runs a native config command (`arcanum-check-config`) in the image. It loads the config surface from `shared/lib/`, so an image that cannot resolve `shared/` fails there instead of only for users.
- **Updates.** The zip updater copies the new tree over the old one, then removes paths that dropped out of the `MANIFEST`. Git-clone installs update through `git checkout <tag>`.
- **CLI bundle.** The CLI bundles the surface into `dist/arcanum.mjs` with `esbuild`, from `shared/lib/`.

See [Install & Release Pipeline](install-and-release.md) and [Docker Engine](docker-engine.md).

## Tooling and CI

- **The package.** `shared/package.json` (`@arcanum/shared`, `private: true`) has zero runtime dependencies. Jasmine, c8, ESLint and its plugins are devDependencies, locked in its own `yarn.lock`. It uses `"type": "module"` and the same `engines.node` floor as `core/` (`>=22.13.0`).
- **Dev container.** A `shared` service in `core/docker-compose.yml`, working in `shared/`, with its own `shared_node_modules` volume.
- **Makefile.** `make shared-install`, `shared-lint`, `shared-test`, `shared-check` (lint, then test), `shared-shell` and `shared-audit`, mirroring the `cli-*` targets. There is no build step.
- **CircleCI.** The `test` workflow runs two jobs from `shared/`:
  - `shared`: install, lint, specs with coverage, a non-blocking partial Codacy upload and a non-blocking `yarn audit`;
  - `shared-node-floor`: the specs again on `cimg/node:22.13.0`, because the CLI ships this code to users on the floor.
- **Codacy.** `test` (core) and `shared` each upload a partial lcov report (`report --partial`), after rewriting `SF:` paths to be relative to the repo root. The `coverage-final` job, which requires both, sends Codacy's `final` call. Every upload is non-blocking.

## Testing

- **Coverage is enforced.** `shared/package.json` sets c8's `check-coverage: true`, with thresholds of 99% lines, 100% functions, 98% branches and 99% statements.
- **Strict-keys guard.** `shared`'s runner does not set `ARCANUM_STRICT_CONFIG_KEYS=1`, because its unit specs use made-up keys on purpose. The guard itself (a plain `Error` naming the key when the flag is `1`) has its own specs in `KeyRegistry_spec.js` and `RepoConfig_spec.js`. Core's runner keeps setting the flag (`core/spec/support/strictConfigKeys.js`), so the real keys used by core and the shell scripts stay checked.
- **Interop and parity specs stay in core.** `Lock` against `arcanum/_lib/lock.sh` and every shell-vs-native parity spec need bash and `arcanum/_lib/`. They stay in `core/spec`, so `shared/spec` never reaches outside its folder. Core's remaining specs and the CLI smoke specs exercise `shared/` through real imports.
- **Zero dependencies.** `shared/spec/packaging/package_spec.js` asserts that `dependencies`, `optionalDependencies` and `peerDependencies` are absent or empty, and that the package is private.

## Writer API

`shared/lib/config/RepoConfigWriter.js` performs every config write. Every method takes one object argument:

- **`write({ newFile, legacyFile, namespace, key, value, timeoutMs })`** sets a value.
  - With a `namespace`, it first seeds `.<namespace>` from `legacyFile` when `newFile` lacks it, then sets `.<namespace>.<key>`.
  - Without a `namespace`, `key` is a path from the root of the file (a top-level write), and `legacyFile` is ignored.
  - A dotted `key` is a nested path: missing intermediate objects are created, and siblings and their order are kept.
- **`setVersion({ file, version, namespace, timeoutMs })`** sets `.version`, or `.<namespace>.version`.
- **`unset({ newFile, legacyFile, namespace, key, timeoutMs })`** deletes a key, the counterpart of `write`.
  - It seeds from `legacyFile` exactly as `write` does, so the reader's legacy fallback cannot bring the value back.
  - A missing leaf, or a missing or `null` intermediate, is a no-op: the file is neither rewritten nor created.
  - It throws `ConfigError` `NOT_AN_OBJECT` when the file, the namespace or an intermediate holds a non-object value.
  - Empty parent objects left behind are kept.
- **`update({ newFile, legacyFile, namespace, key, mutate, timeoutMs })`** is an atomic read-modify-write of one key. The first consumer is #781's `arcanum config auto-fix-all ignore-checks add/remove`.
  - Under `<newFile>.lock`, it seeds from `legacyFile` exactly as `write` does, reads the current value at the key (`undefined` when the leaf, or a missing or `null` intermediate, is absent), and writes `mutate`'s result with `write`'s semantics. Without a `namespace`, `key` is a path from the root and `legacyFile` is ignored.
  - `mutate` receives a `structuredClone` of the current value, so changing it in place cannot corrupt `previous`. It may be async.
  - When the result deep-equals the current value (a structural comparison of plain JSON values that ignores key order), nothing is written: the file is neither rewritten nor created, and a legacy seed alone is not persisted.
  - It resolves to `{ changed, previous, value }`: whether the file was written, the value before the call and the value after it.
  - A `mutate` that returns `undefined` is a usage error (`TypeError`) and writes nothing; deleting a key stays `unset`'s job.
  - A `mutate` that throws writes nothing, releases the lock and propagates the error unchanged.
  - It throws `ConfigError` `NOT_AN_OBJECT` when the file, the namespace or an intermediate holds a non-object value.
- **`timeoutMs`** is optional on every method. Omitted, the writer waits for the lock forever, as the shell writers do. When it runs out, the method throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`) and writes nothing.

Every write holds `<file>.lock` through `Lock.js`, the same protocol as `arcanum/_lib/lock.sh`, so shell and native writers exclude each other. The output matches jq's default formatting (`JSON.stringify(obj, null, 2) + '\n'`, existing key order kept, new keys appended). The file is written atomically through `<file>.tmp` and a rename. See [Lock System](lock-system.md).

## Security

- **Zero runtime dependencies,** enforced by a spec (see [Testing](#testing)), so the CLI never pulls third-party code into `~/.claude`.
- **The two-way boundary** (see [Import boundary](#import-boundary)): `shared/lib` imports only `node:` built-ins and itself, with no dynamic `import()`, and `core/` and `cli/` never import `shared/spec/**`.
- **Core's safety conventions** apply, as recorded in the `shared` agent file:
  - `child_process` only through `execFile`/`spawn` with an argument array, never `exec()` with a built-up string;
  - no real network calls in specs;
  - never print a token.
- **Supply chain.** `shared/` has its own `yarn.lock`, and its CI job runs `yarn audit`, non-blocking. Its devDependencies are its only supply-chain surface.
- **Read-only runtime image.** The image's `chmod -R a+rX,go-w /opt/arcanum` covers `shared/`, and nothing in `shared/` writes next to itself.

## Alternatives considered

- **A published npm package, or a workspace package.** Rejected: `core/` ships with no runtime npm dependency in the release zip and the image, and installs run it straight from disk. A workspace needs a root `package.json` and an install step that no install flow has.
- **A mount, copy or symlink of `shared/` at a core path.** Rejected: the native engine, git-clone installs and zip installs run core from disk with no mount or build step; a committed symlink means double linting, double coverage and two copies in the zip, and is fragile on Windows; an install-time copy would be needed in the installer, the updater and the git-clone flow.
- **Keeping the surface in core.** Reversed by #816: it needed a hand-kept file list and import regex in `core/eslint.config.mjs`, put CLI-only writer changes in `node`'s scope, and let a `core/` edit change the CLI bundle silently.

## See also

- [Script Engine](script-engine.md): the native dispatcher that consumes the surface.
- [Shared State & Configuration Files](shared-state-and-configuration.md): the config tiers and the key registry.
- [Arcanum CLI spec](../specs/arcanum-cli.md): the CLI that bundles the surface (still a spec until #785 and #786 promote it).
