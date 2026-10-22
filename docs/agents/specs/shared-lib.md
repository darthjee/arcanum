# Spec: Shared Lib

## Status

Proposed. Nothing in this spec is implemented yet.

Origin: epic #816 (design discussion), which came out of the refinement of #780 (generic `arcanum config` commands). #780 is on hold until this spec is implemented.

From this spec's merge on, it is the source of truth for the `shared/` lib design, and it supersedes the epic body, as [Arcanum CLI](arcanum-cli.md) did for #767. Later changes, from the implementation items (#819–#827) or review, are made here and are not back-ported to #816. The epic body is a historical snapshot; only its split list may still change.

Where this spec disagrees with the [Arcanum CLI](arcanum-cli.md) specs, this spec wins. The reversed sections there carry a "Suspended" banner until #826 rewrites them.

## Goal and Non-goals

**Goal.** A new root folder, `shared/`, holds **code shared by `core/` and `cli/`**. Its first content is the config surface that the CLI bundles today out of `core/lib` (see [Shared Config Logic](arcanum-cli/shared-config-logic.md)). A new `shared` agent owns it. New code that both consumers need goes into `shared/`, not into `core/lib`.

Why:

- The surface is declared today only by a hand-maintained `files` list and a negative-lookahead import regex in `core/eslint.config.mjs`.
- It is owned by `node`, but #780 needs new writer capabilities on it that only the CLI uses. With that split, every CLI change becomes a `node` + `client` change.
- A `core/` edit can change the CLI bundle by accident.

**Non-goals:**

- Publishing `shared/` to npm, or giving it any runtime dependency.
- Consolidating the duplicated `CLAUDE_CONFIG_DIR || $HOME/.claude` resolution (`core/lib/context/ClaudeContext.js` and `ConfigChain._globalConfigFile`). That is a possible follow-up.
- The shell `arcanum/_lib/*config*.sh` helpers.
- The CLI-only behaviours, which stay in `cli/`: the malformed-file refusal, `--claude-config-dir` handling and exit-code mapping.
- Reviewing the other dev-only files shipped in the release zip and the runtime image. That is #817.

## Layout

The layout is **flat**: there is no `utils/` level. Core's `utils/` means something only inside core's `commands → context/services → utils` layering, and `shared/` has no such layering.

```text
shared/
  lib/
    config/   ConfigChain.js, RepoConfig.js, RepoConfigWriter.js, ConfigError.js, AgentEmail.js, KeyRegistry.js, keys.json
    file/     Lock.js, LockTimeoutError.js, RepoPath.js
  spec/
    config/   <Name>_spec.js, mirroring lib/config/ 1:1
    file/     <Name>_spec.js, mirroring lib/file/ 1:1
    support/  the spec support only these specs use (copied, see Migration steps)
  package.json, yarn.lock, eslint.config.mjs, README.md
```

**What moves:** exactly today's declared surface, the 9 files of the `files` list in `core/eslint.config.mjs`'s shared-surface block, plus `keys.json`:

| From | To |
| --- | --- |
| `core/lib/utils/config/ConfigChain.js` | `shared/lib/config/ConfigChain.js` |
| `core/lib/utils/config/RepoConfig.js` | `shared/lib/config/RepoConfig.js` |
| `core/lib/utils/config/RepoConfigWriter.js` | `shared/lib/config/RepoConfigWriter.js` |
| `core/lib/utils/config/ConfigError.js` | `shared/lib/config/ConfigError.js` |
| `core/lib/utils/config/AgentEmail.js` | `shared/lib/config/AgentEmail.js` |
| `core/lib/utils/config/KeyRegistry.js` | `shared/lib/config/KeyRegistry.js` |
| `core/lib/utils/config/keys.json` | `shared/lib/config/keys.json` |
| `core/lib/utils/file/Lock.js` | `shared/lib/file/Lock.js` |
| `core/lib/utils/file/LockTimeoutError.js` | `shared/lib/file/LockTimeoutError.js` |
| `core/lib/utils/file/RepoPath.js` | `shared/lib/file/RepoPath.js` |

- Every import in `core/` and `cli/` is rewritten to point at the new path. **No re-export shims** are left at the old `core/lib` paths.
- Behaviour stays the same: no API, message or output changes. Dispatcher output, exit codes and parity tests stay byte-identical.

**What stays in core:** `BooleanKeyConfig`, `NamespacedBooleanKeyConfig` and `DispatchFailure`. They are the native `config.sh` dispatch layer, not the surface (see [Shared Config Logic](arcanum-cli/shared-config-logic.md#source-stays-in-core)). The other files in `core/lib/utils/file/` (`InstallRoot`, `InstallVersion`, `IssueFileLocator`, `IssueStatePaths`) are core-only and stay too.

## Ownership

| Agent | Owns for this change |
| --- | --- |
| `shared` (new, created by #819) | All of `shared/`: `shared/lib/`, `shared/spec/`, `shared/package.json`, `shared/yarn.lock`, `shared/eslint.config.mjs`, `shared/README.md`. Its scope is "code consumed by both `core/` and `cli/`". |
| `node` | `core/`'s Node.js source and config, **minus** the surface. It requests changes to `shared/` through `architect`. |
| `client` | All of `cli/`, **minus** the surface it bundles. It requests changes to `shared/` through `architect`. |
| `infra` | The `shared` compose service, the `shared-*` Makefile targets, the CircleCI `shared` jobs, and the packaging specs (see [Tooling and CI](#tooling-and-ci)). |
| `architect` | This spec, `AGENTS.md`, the agent roster and `docs/agents/folder-structure.md`. |

- **The `keys.json` exception.** `shared` owns `keys.json`, its loader (`KeyRegistry.js`) and its schema. Any agent may still add, edit or remove an entry for a config key that its own change introduces, so adding a key never needs a separate `shared` dispatch. #819 records this exception in the `shared`, `node` and `scripter` agent files.
- **The drift rule** (see [Migration steps](#migration-steps)) is written into the `shared`, `node` and `client` agent files by #819 and removed by #824.
- **Core's safety conventions carry over** into the `shared` agent file (see [Performance and security](#performance-and-security)).
- **Reserved skill name.** The install root is the skills dir, so `shared/` lands at `<skills>/shared/`. Without a `SKILL.md`, Claude Code ignores it, like `core/` and `arcanum/`. It does reserve `shared` as a skill name; #819 records this in `docs/agents/folder-structure.md`.

## Import boundary

**Plain relative imports.** `core/` and `cli/` import the root `shared/` by relative path, e.g. `../../../shared/lib/config/ConfigChain.js`. `shared/` is not a package dependency of either.

**Why not a mount, copy or symlink at a core path.** Making `shared/` appear under `core/` was rejected:

- the native engine on the host, git-clone installs and zip installs all run core straight from disk, with no mount or build step;
- a committed symlink causes double linting and double coverage, is stored as two copies in the zip, and is fragile on Windows;
- an install-time copy step would be needed in the installer, the updater and the git-clone flow.

Node's `package.json` `imports` field cannot point outside its own package, so relative paths are the only zero-dependency option. [Migration steps](#migration-steps) make the final switch a single prefix change.

**The two-way lint rules:**

| Side | Rule | Enforced by |
| --- | --- | --- |
| `shared/lib/**` | May import only `node:` built-ins and files under `shared/lib/`. No dynamic `import()`. Bare built-ins (`'fs'`) are rejected. | `shared/eslint.config.mjs` (a folder rule, moved from core by #824) |
| `core/**` | May import `shared/lib/**`, never `shared/spec/**`. | `core/eslint.config.mjs` |
| `cli/**` | May import `shared/lib/**`, never `shared/spec/**`, and nothing else outside `cli/`. | `cli/eslint.config.mjs` |
| CLI bundle | Every bundled input lies under `cli/lib/**` or `shared/lib/**`. | `cli/scripts/build.mjs`'s metafile check |

- **Everything under `shared/lib` is public.** There is no second allowlist: the folder is the surface. This replaces the 9-file `files` list and the negative-lookahead regex in `core/eslint.config.mjs`, and the CLI's list of surface entry files.
- Lint rules match the import **specifier**, not the resolved path. The build's metafile check covers resolved paths for the bundle, and the specs cover the rest.

## Migration steps

The move goes **step by step**: consolidate inside core, then copy, then switch. It is not one big move.

1. **Consolidate inside core (#820).** Move the 10 files into `core/lib/shared/{config,file}/`, and their moved specs into `core/spec/lib/shared/{config,file}/`. Rewrite the imports in `core/` and `cli/`. Replace the 9-file allowlist in `core/eslint.config.mjs` with a folder rule (`core/lib/shared/**` may import only `node:` built-ins and itself). Repoint the CLI lint restriction and the build metafile check. Behaviour stays the same.
2. **Copy (#822).** Scaffold `shared/` and **copy** (not move) `core/lib/shared/{config,file}/` into `shared/lib/{config,file}/`, and the moved and duplicated specs into `shared/spec/`. `core/` and `cli/` are not touched.
3. **Switch (#824).** `core/` and `cli/` import `shared/` by relative path. Thanks to step 1, this is a prefix change (`core/lib/shared/` → `shared/lib/`). Delete `core/lib/shared/` and `core/spec/lib/shared/`, with no re-export shims. Move core's folder lint rule to `shared/`, and repoint `cli/eslint.config.mjs`'s restriction and `cli/scripts/build.mjs`'s metafile check at `shared/`. Repoint code comments that name the old paths (`arcanum/_lib/lock.sh`, `cli/scripts/build.mjs`).

**Drift rule for the copy window.** Between steps 2 and 3, the surface exists in both `core/lib/shared/` and `shared/lib/`. No change to those files is planned in that window. If one is unavoidable, it is made in **both** copies.

**Diff check.** Step 3 opens with a diff of the two copies: they must be identical apart from import paths. If they are not, #824 re-syncs them before switching, and the diff check closes the copy window.

### Spec-file inventory

Every file under `core/spec` and `cli/spec` that the move affects, derived from the import graph of the 10 surface paths (plus the support files those specs use). #820 and #822 follow this list; they do not re-derive it.

- **moved:** a unit spec of a surface file. It goes to `core/spec/lib/shared/` in #820, is copied to `shared/spec/` in #822, and its core copy is deleted in #824.
- **stays in core** (or **stays in cli**): code that tests core, cli or shell code, possibly *against* the surface. Only its import paths change, in #820 and #824.
- **duplicated:** needed on both sides. `shared/spec` gets its own copy in #822 and core keeps its own. Spec support is **copied, never imported across folders**: `shared/spec` never imports from `core/spec`, and the reverse.

**Moved:**

| File | Target in `shared/spec/` |
| --- | --- |
| `core/spec/lib/utils/config/AgentEmail_spec.js` | `config/AgentEmail_spec.js` |
| `core/spec/lib/utils/config/ConfigChain_spec.js` | `config/ConfigChain_spec.js` |
| `core/spec/lib/utils/config/ConfigError_spec.js` | `config/ConfigError_spec.js` |
| `core/spec/lib/utils/config/KeyRegistry_spec.js` | `config/KeyRegistry_spec.js` |
| `core/spec/lib/utils/config/keys_spec.js` | `config/keys_spec.js` |
| `core/spec/lib/utils/config/RepoConfig_spec.js` | `config/RepoConfig_spec.js` |
| `core/spec/lib/utils/config/RepoConfigWriter_spec.js` | `config/RepoConfigWriter_spec.js` |
| `core/spec/lib/utils/file/LockTimeoutError_spec.js` | `file/LockTimeoutError_spec.js` |
| `core/spec/lib/utils/file/RepoPath_spec.js` | `file/RepoPath_spec.js` |

**Duplicated:**

| File | Notes |
| --- | --- |
| `core/spec/lib/utils/file/Lock_spec.js` | Split by what each side can run. `shared/spec/file/Lock_spec.js` gets the unit `describe`s (`#acquire`, mutual exclusion, `#release`, stale locks, bound). Core keeps the "cross-implementation race with `arcanum/_lib/lock.sh`" block, which needs bash and `arcanum/_lib/`. |
| `core/spec/support/utils/tempDir.js` | Copied to `shared/spec/support/utils/`. Used by most moved specs. |
| `core/spec/support/utils/gitFixtureRepo.js` | Copied to `shared/spec/support/utils/`. Used by `RepoPath_spec.js`. |
| `core/spec/support/fixtures/agentEmailFixtures.js` | Copied to `shared/spec/support/fixtures/`. Used by `AgentEmail_spec.js` (shared) and `core/spec/bin/agentEmailParity_spec.js` (core), so the shell/native parity table stays one table per side. |
| `core/spec/support/factories/repoContextFactory.js` | Shared gets a **reduced** copy: a plain `{ repoPath }` stub instead of core's `RepoContext`, which `shared/spec` cannot import. `ConfigChain` and `RepoConfig` only read `repoContext.repoPath`. Core's factory is unchanged. |

**Stays in core** (import paths rewritten only):

| File | Why |
| --- | --- |
| `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` | Checks core and shell defaults against the registry. |
| `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js` | Scans the shell helpers in `arcanum/_lib/` against the registry. |
| `core/spec/support/utils/shellConfigKeys.js` | Support for `ShellConfigKeyScan_spec.js`. |
| `core/spec/support/strictConfigKeys.js` | Core's runner hook that sets `ARCANUM_STRICT_CONFIG_KEYS=1` (see [Testing](#testing)). |
| `core/spec/lib/utils/config/BooleanKeyConfig_spec.js` | Tests core's dispatch layer. |
| `core/spec/lib/utils/config/NamespacedBooleanKeyConfig_spec.js` | Tests core's dispatch layer. |
| `core/spec/bin/agentEmailParity_spec.js` | Shell/native parity; needs bash and `arcanum/_lib/`. |
| `core/spec/lib/commands/arcanum-check-config/ArcanumCheckConfig_spec.js` | Core command spec. |
| `core/spec/lib/commands/auto-fix-all/AutoFixAllConfig_spec.js` | Core command spec. |
| `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js` | Core command spec. |
| `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePush_spec.js` | Core command spec. |
| `core/spec/lib/commands/init-claude/InitClaudeSetCiIgnoredPatterns_spec.js` | Core command spec. |
| `core/spec/lib/commands/init-claude/InitClaudeSetNextStepAuto_spec.js` | Core command spec. |
| `core/spec/lib/commands/init-claude/InitClaudeSetNextStepClear_spec.js` | Core command spec. |
| `core/spec/lib/commands/init-claude/InitClaudeStampArcanumVersion_spec.js` | Core command spec. |
| `core/spec/lib/commands/monitor-issues/MonitorIssuesConfig_spec.js` | Core command spec. |
| `core/spec/lib/commands/monitor-issues/MonitorIssuesRewriteQueue_spec.js` | Core command spec. |
| `core/spec/lib/commands/shared/NextStepPrompt_spec.js` | Core command spec. |
| `core/spec/lib/commands/shared/PermissionGrant_spec.js` | Core command spec. |
| `core/spec/lib/commands/shared/SafeBranch_spec.js` | Core command spec. |
| `core/spec/lib/services/IssueStateServiceAppendJson_spec.js` | Core service spec. |
| `core/spec/lib/services/IssueStateServiceSet_spec.js` | Core service spec. |
| `core/spec/lib/services/IssueStateServiceWrite_spec.js` | Core service spec. |
| `core/spec/support/factories/autoFixAllQueue.js` | Core spec support (imports `Lock`). |
| `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js` | Core spec support (imports `Lock`). |

**Stays in cli** (paths rewritten only):

| File | Change |
| --- | --- |
| `cli/spec/lib/commands/config_spec.js` | Imports `KeyRegistry`. |
| `cli/spec/scripts/build_spec.js` | Its surface path list and metafile fixtures point at the new paths. |
| `cli/spec/packaging/eslintBoundary_spec.js` | Asserts the folder boundary instead of the entry-file list. |

`core/spec/support/jasmine.json` and `jasmine-docker.json` are not copied: `shared/` gets its own runner config, without the strict-keys helper.

## Packaging and runtime

- **Development.** The whole-repo bind mount of the dev container already exposes `shared/` next to `core/` and `cli/`. No new mount.
- **Release zip.** `scripts/build_release_zip.sh` packages every git-tracked file except its `EXCLUDES` list, so `shared/` ships with no change. `node_modules/` and `coverage/` are already excluded by their globs.
- **Runtime image.** It does `COPY . /opt/arcanum`, filtered by the root `.dockerignore`, which mirrors `EXCLUDES`. `/opt/arcanum/shared/` sits next to `core/`, so the relative imports resolve.
- **Specs are not shipped (#821).** `core/spec/` and `shared/spec/` are added to `EXCLUDES` and to `.dockerignore`. A packaging spec asserts that `build_release_zip.sh --list` contains no `*/spec/` path.
- **Updates.** The zip updater (`arcanum/update/updater.sh`) copies the new tree over the old one, then removes paths that dropped out of the `MANIFEST`. That removes the deleted `core/lib` copies, and `core/spec/` after #821, from existing installs. Git-clone updates get the same through `git checkout <tag>`.
- **CLI bundle.** The CLI keeps bundling the surface into `dist/arcanum.mjs` with `esbuild`, from the new path.

## Tooling and CI

- **The package.** `shared/package.json` has **zero runtime dependencies**, with Jasmine, c8 and ESLint as devDependencies, its own `yarn.lock`, and the same `"type": "module"` and `engines.node` floor as `core/`.
- **Dev container (#823).** A `shared` service in `core/docker-compose.yml`, with its own `node_modules` volume.
- **Makefile (#823).** `shared-*` targets in the root `Makefile`, mirroring the `cli-*` ones.
- **CircleCI (#823).** A `shared` job in the `test` workflow: install, lint, specs with coverage, and `yarn audit` (non-blocking, like `checks` and `cli`).
- **Node floor (#823).** `shared`'s specs also run on Node 22.13, like `cli-node-floor`, because the CLI ships this code to users on the floor.
- **Codacy (#823).** A non-blocking `shared` lcov upload. Because core uploads for the same commit, both use Codacy's `--partial` uploads followed by one `final` call.
- **Packaging specs**, in `core/spec`:
  - `build_release_zip.sh --list` includes `shared/lib/` (#823, like the existing `arcanum-next-step/` one);
  - `build_release_zip.sh --list` contains no `*/spec/` path (#821).

## Writer additions

#780 needs three capabilities that `RepoConfigWriter` lacks. #825 adds them in `shared/lib/config/RepoConfigWriter.js`, with specs, **after** the switch, so each change is made once and the move's PRs stay purely mechanical.

This spec fixes the **behaviour contract** only. Method names and signatures are left to #825.

| Addition | Behaviour |
| --- | --- |
| Delete a dotted path (for `arcanum config unset`) | Deleting a missing key is a no-op, not an error. Empty parent objects left behind are **not** pruned. |
| Pass a lock `timeoutMs` through (for `--lock-timeout`) | Optional. Omitted means wait forever, as today. `Lock.acquire` already supports the bound (#807); `RepoConfigWriter._locked` passes it on. Exhausting it throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`). |
| Write a top-level key | Today `write()` always needs a `namespace` plus a `key`. A top-level write sets one key at the root of the file and **keeps its siblings**. |

Existing callers are unchanged: the current `write` and `setVersion` behave exactly as before. Once #825 is done, #780 becomes a pure `client` issue.

## Backward compatibility

The switch is backward compatible by construction:

| Area | Why it holds |
| --- | --- |
| Dispatcher and parity tests | The move does not change behaviour. Parity tests stay in `core/spec` with only import paths changed, so shell vs native stays byte-identical. |
| CLI bundle | `esbuild` inlines the same code from a new path. The existing smoke specs cover the built bundle. |
| `docker` engine mode | The runtime image's `COPY .` puts `/opt/arcanum/shared/` next to `core/`. Image tags are per version and immutable, so a pre-switch image is never paired with post-switch code. `local-<HEAD>` dev images are retagged on every commit. |
| Release zip | `build_release_zip.sh` ships every tracked file except `EXCLUDES`, so `shared/` ships with no change. |
| Zip update | The updater's `MANIFEST` diff removes the deleted `core/lib` copies from existing installs. |
| Git-clone update | `git checkout <tag>` handles the additions and deletions. |
| A release cut mid-epic (after #822, before #824) | It ships both copies. Nothing imports `shared/` yet, so it is harmless; no release freeze is needed. |
| Shell helpers, config and state files | Untouched. No file changes shape, so **no migration is needed**. |

Two risks would be silent in CI today. Each gets a guard:

- **Packaging (#823).** A later `EXCLUDES` entry could drop `shared/` from the zip. The `core/spec` packaging spec asserts that `--list` includes `shared/lib/`.
- **Runtime image (#824).** `make core-smoke-runtime` never loads native code, so an image that cannot resolve `shared/` (or a future runtime dependency that `yarn install --production`, run in `core/` only, misses) would show up only for users. #824 extends the smoke check to run one native config command in the image (e.g. `arcanum-check-config`).

## Testing

- **Coverage is enforced in `shared/` from the start.** `shared/package.json` sets c8's `check-coverage: true`. The thresholds are what the moved and duplicated specs reach in #822, rounded down. Core's whole suite covers the surface at about 99% of lines and branches today, but `shared`'s own specs may reach less. Core and cli keep their current, non-enforced settings; changing them is out of scope.
- **Strict-keys guard.** `shared`'s spec runner does **not** set `ARCANUM_STRICT_CONFIG_KEYS=1`, because its unit specs use made-up keys on purpose to test resolution. The guard's own behaviour (`ConfigError('UNREGISTERED_KEY')` when the flag is set) gets explicit specs in `shared/spec`. Core's runner keeps setting the flag, so the real keys used by core and the shell scripts stay checked.
- **Interop and parity specs stay in core.** `Lock` against `arcanum/_lib/lock.sh` and every shell-vs-native parity spec need bash and `arcanum/_lib/`. They stay in `core/spec`, so `shared/spec` never reaches outside its folder.
- **The copy window** (#822 to #824). Each copy is tested by its own suite: core's specs against `core/lib/shared/`, `shared`'s specs against `shared/lib/`. The diff check closes the window. After the switch, core's remaining specs and the CLI smoke specs exercise `shared/` through real imports, which proves the relative paths resolve.
- **Zero-dependency spec (#822).** A packaging spec in `shared/spec` asserts that `shared/package.json` has no (or empty) `dependencies`, `optionalDependencies` and `peerDependencies`.

## Performance and security

**Performance.** Nothing is load-sensitive. The runtime code and module count are unchanged, the longer relative paths resolve at negligible cost, and the `esbuild` bundle has the same content. #821 slightly shrinks the zip and the runtime image. The new `shared` CI jobs cost about as much as the `cli` job and run in parallel.

**Security:**

- **Zero runtime dependencies, enforced by a spec** (see [Testing](#testing)), so the CLI can never pull third-party code into `~/.claude`.
- **The two-way boundary** (see [Import boundary](#import-boundary)): `shared/lib` imports only `node:` built-ins and itself, with no dynamic `import()`; `core/` and `cli/` never import `shared/spec/**`.
- **Core's safety conventions** carry into the `shared` agent file (#819):
  - `execFile`/`spawn` with an argument array, never `exec()` with a built-up string;
  - no real network calls in specs;
  - never print a token;
  - the CLI's malformed-file refusal stays in `cli/`.
- **Supply chain.** `shared/` has its own `yarn.lock`, and its CI job runs `yarn audit`, non-blocking. Its devDependencies are its only supply-chain surface.
- **Read-only runtime image.** The existing `chmod -R a+rX,go-w /opt/arcanum` already covers `shared/`, and nothing in `shared/` writes next to itself. No change is needed.

## Alternatives considered

- **A published npm package, or a workspace package.** Rejected: `core/` ships with zero runtime npm dependencies inside the release zip and the Docker image, and installs run it straight from disk, so it cannot depend on a published package. A workspace needs a root `package.json` and install step that no install flow has.
- **A mount, copy or symlink of `shared/` at a core path.** Rejected; see [Import boundary](#import-boundary).
- **One big move instead of steps.** Rejected: a single PR touching `core/`, `cli/`, a new package, Docker, Makefile and CI at once is hard to review and to revert. Consolidating first makes the switch a prefix change, and the copy step lets `shared/`'s tooling land and go green before anything depends on it.
- **Keeping the surface in core** (the previous decision in [Shared Config Logic](arcanum-cli/shared-config-logic.md#source-stays-in-core)). Reversed: it keeps the hand-kept file list and regex, keeps CLI-only writer changes in `node`'s scope, and lets a `core/` edit change the CLI bundle silently.

## Implementation order

One sub-issue per item of #816's split. Each refers to its dependencies as "item N of #816".

| Item | Issue | Work | Owner | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #818 | Write this spec. | `architect` | — |
| 2 | #819 | Create the `shared` agent; update `AGENTS.md`, the agent roster and `folder-structure.md`; narrow `node` and `client`; record the `keys.json` exception, the drift rule and the reserved skill name. | `architect` | 1 |
| 3 | #820 | Consolidate inside core (`core/lib/shared/`), with the folder lint rule. | `node` + `client` | 2 |
| 4 | #821 | Stop shipping specs in the zip and the runtime image. | `infra` | — |
| 5 | #822 | Scaffold `shared/` and copy the surface and its specs into it. | `shared` | 3, 4 |
| 6 | #823 | Dev container, Makefile, CircleCI, Node floor, Codacy, and the `shared/lib/` packaging spec. | `infra` | 5 |
| 7 | #824 | Switch `core/` and `cli/` to `shared/`, remove the core copy, extend the runtime smoke check. | `node` + `client` | 5, 6 |
| 8 | #825 | Writer additions for #780. | `shared` | 7 |
| 9 | #826 | Promote this spec into architecture docs; rewrite the suspended `arcanum-cli` spec sections and every doc that points at `core/lib/utils/config`; update the `architecture.md` index. | `architect` | 7, 8 |
| 10 | #827 | Remove this spec (and `shared-lib/`, if it was split). | `architect` | 9 |

Path references are repointed as they move: code comments in #824; agent files (`node.md`, `scripter.md`, `client.md`) in #819; architecture docs (`lock-system.md`, `docker-engine.md`, `shared-state-and-configuration.md`) in #826. Plain `core/lib/...` mentions in the `arcanum-cli` specs (e.g. `command-surface.md`) carry no banner and are repointed in #826.

## Open points

None left. The `ClaudeContext` config-dir consolidation is a possible follow-up outside #816; #817 is related but separate.

## See also

- [Arcanum CLI](arcanum-cli.md) and its parts [Shared Config Logic](arcanum-cli/shared-config-logic.md), [Key Registry](arcanum-cli/key-registry.md) and [Packaging and Release](arcanum-cli/packaging-and-release.md): the decisions this spec revises.
- [Script Engine](../architecture/script-engine.md): the native dispatcher that consumes the surface.
- [Docker Engine](../architecture/docker-engine.md): the runtime image.
- [Install and Release](../architecture/install-and-release.md): the release zip, `EXCLUDES` and the updater.
- [Lock System](../architecture/lock-system.md): the lock protocol `Lock.js` implements.
- [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md): the three tier files.
- [Agent Roster and Delegation](../architecture/agent-roster-and-delegation.md): where the `shared` agent is added.
