# Arcanum CLI: Shared Config Logic

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define how the CLI reuses arcanum's existing config read/write code, so that it reads and writes config exactly like the skills do: same tier files, same dotted-path semantics, same locking.

## Decisions

### Source lives in `shared/`

The config logic lives in the root `shared/` lib as the single source, owned by `shared`, and both `core/` and `cli/` import it by relative path (see [Shared Lib](../../architecture/shared-lib.md)). Epic #816 moved it there out of `core/lib`. The **shared surface** is the set of `shared/lib` files the CLI bundles:

| File | Role |
| --- | --- |
| `shared/lib/config/ConfigChain.js` | Local → repo → global resolution, including `readWithSource` (see [Shared agent-email helper](#shared-agent-email-helper)). |
| `shared/lib/config/RepoConfig.js` | Repo-tier reads. |
| `shared/lib/config/RepoConfigWriter.js` | Every config write, with the lock. |
| `shared/lib/config/ConfigError.js` | The shared error contract (see [`ConfigError`](#configerror)). |
| `shared/lib/config/AgentEmail.js` | Shared agent-email resolution (see [Shared agent-email helper](#shared-agent-email-helper)). |
| `shared/lib/config/KeyRegistry.js` and `keys.json` | The [Key Registry](key-registry.md#location) and its loader, validator and matcher. |
| `shared/lib/file/Lock.js` | The lock, compatible with the shell `lock.sh` (see [Lock](#lock)). |
| `shared/lib/file/LockTimeoutError.js` | The error `Lock` throws when its optional `timeoutMs` bound runs out (`code: 'LOCK_TIMEOUT'`); imported by `Lock.js`, so it is bundled with it. |
| `shared/lib/file/RepoPath.js` | Repo-path validation and root normalization (see [Repo-root normalizing helper](#repo-root-normalizing-helper)). |

- **The folder is the declaration.** Everything under `shared/lib` is public, so there is no separate file list (see [Guardrails](#guardrails)). This table explains what is there today.
- **`BooleanKeyConfig` is not on the surface.** It stays in `core/lib/utils/config/`, with `NamespacedBooleanKeyConfig`. It is the native `config.sh` dispatch layer: subcommand-named methods, `"\n"`-terminated stdout strings, `toggle`, and `throw new DispatchFailure('', 1)` as `is-enabled`'s "false" exit signal. It stays core-only and keeps `DispatchFailure`, which is a dispatch protocol there, not an error. Its subclasses (`AutoFixAllConfig`, `MonitorIssuesConfig`) target the same namespaced repo file with legacy fallback that `ConfigChain` and `RepoConfigWriter` already handle, so the CLI reads every key through `ConfigChain` and writes every key through `RepoConfigWriter`.
- **JSDoc `RepoContext` references stay.** `ConfigChain` and `RepoConfig` reference core's `RepoContext` only inside JSDoc `import('…')` types, marked "optional, core-only". Neither ESLint nor `esbuild` reads them, so they pull nothing into the bundle. They document an optional dependency that only core injects; the CLI never passes `repoContext`.
- **Strict-keys guard.** `ConfigChain#read` and `RepoConfig`'s read gain the registry's test-only guard: under `ARCANUM_STRICT_CONFIG_KEYS=1`, set by core's spec runner, they throw `ConfigError('UNREGISTERED_KEY')` on a key that matches no registry entry. Production behaviour is unchanged (see [Key Registry](key-registry.md#enforcing-a-new-key-means-a-registry-entry)).

### `ConfigError`

A small class on the shared surface, `shared/lib/config/ConfigError.js`:

```js
class ConfigError extends Error {
  constructor(code, message, { file } = {}) { super(message); this.code = code; this.file = file; }
}
```

| `code` | Thrown by | Message |
| --- | --- | --- |
| `NOT_AN_OBJECT` | `RepoConfigWriter` (`_readBase`, namespace, intermediate path) | Unchanged: `Cannot index <file\|.path>: not a JSON object`. |
| `INVALID_JSON` | `RepoConfigWriter#_readLegacy` | The unchanged parse error. |
| `LOCK_TIMEOUT` | `Lock`, when its optional `timeoutMs` bound is exhausted (#807). Thrown as `LockTimeoutError`, not a `ConfigError`, with the same `code` | Names the lock file. |
| `UNREGISTERED_KEY` | The strict-keys guard in `ConfigChain#read` / `RepoConfig`'s read (test-only) | Names the key. |

- **Native fs errors** (`EACCES`, `ENOSPC`, `EISDIR`, …) propagate unwrapped. They already carry `error.code`.
- **Validation is not a `ConfigError`.** Exit `3` is settled in [Key Registry](key-registry.md): `KeyRegistry#check` returns a structured result instead of throwing.
- **Dispatcher: no mapping.** `ConfigError extends Error` and keeps today's messages, so `core/bin/arcanum`'s bare-`Error` path (`arcanum: <message>` on stderr, exit `1`) is unchanged. There is no new branch, and output and exit codes stay byte-identical.
- **CLI mapping.** A single function in `cli/lib/` maps errors to the [Command Surface](command-surface.md#exit-codes) exit codes:
  - `LOCK_TIMEOUT` → `6` (`EXIT_LOCK_TIMEOUT`);
  - `NOT_AN_OBJECT`, `INVALID_JSON` and any Node errno error → `7` (`EXIT_FILE`);
  - `UNREGISTERED_KEY` and anything unrecognised → `1` (`EXIT_ERROR`).
- **Edge case: non-object intermediate.** The CLI's own malformed-file check pre-empts a whole-file `NOT_AN_OBJECT`. A non-object intermediate can still reach the writer, e.g. a hand-edited file where `.git` is a string, then `set git.authors …`. It maps to `7`: the problem is the file's content, not the key (see [Command Surface](command-surface.md#missing-and-malformed-tier-files)).

### Lock

**The flaw.** The shared lock protocol (`arcanum/_lib/lock.sh` and its mirror `shared/lib/file/Lock.js`, see [Lock System](../../architecture/lock-system.md)) does not exclude a writer that already holds the lock. Acquire writes its id unconditionally, sleeps 1s and re-reads, and never checks whether the lock file already exists. A late writer therefore "steals" a held lock, both mutate the file concurrently (a silent lost update), and the first to finish `rm -f`s the other's lock. The protocol only arbitrates writers arriving within the same ~1s window. The [Command Surface](command-surface.md#lock-contention) guarantees assume real exclusion.

**Decision: fix the shared protocol** rather than weakening the CLI's guarantees or giving the CLI a private lock, which would still not exclude skills. The fix is code in both shell and `core/`, so it is its own issue, **#807** (owners `node` + `scripter`):

- **Atomic create-if-absent acquire:** Node `writeFile(lockFile, id, { flag: 'wx' })`; Bash `( set -o noclobber; printf '%s\n' "$id" > "$LOCK_FILE" )`. An existing file means wait and retry: forever for skills, bounded for the CLI. No more write → sleep → re-read.
- **Owner-checked release:** delete the file only if it still holds this instance's id.
- **Stale-lock detection:** same hostname and a dead pid (`kill -0` / `process.kill(pid, 0)`) breaks the lock. Cross-host locks keep today's warn-once behaviour.
- **Optional bound on `Lock`** (`acquire(lockFile, { timeoutMs })`), which the CLI passes. Exhausting it throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`), which the CLI's error mapping turns into exit `6` by its code. Skills keep the default, which waits forever.

Consequences:

- **#807 is a hard blocker for the CLI's write commands.** `set`, `unset` and every shortcut that writes do not ship until #807 has landed, so the exclusion guarantees hold from the CLI's first release. Read-only commands (`get`, `list`, `info`) take no lock and are not blocked.
- **#807 stays standalone, outside epic #767.** It fixes a bug that exists without the CLI (e.g. the `auto-fix-all` queue race) and is planned and merged on its own merits. The blocking is made visible instead: this spec records it, and the epic's write-path implementation issue is marked "blocked by #807" when it is created.
- **Timeout semantics.** A timeout means the lock file existed for the whole wait. The CLI wrote nothing, so there is nothing to clean up on timeout or on a signal.
- **Mixed versions.** The npm CLI may be newer than the arcanum install it targets. A new-protocol writer waits on an old writer's file; an old writer can still overwrite a new one's, as today. A mix is never worse than now, and becomes fully exclusive once both sides upgrade. No per-repo migration is needed, since the lock file's shape does not change.

### Repo-root normalizing helper

`shared/lib/file/RepoPath.js` joins the shared surface. It imports only `node:` built-ins, and the CLI already reuses its messages for `--repo` usage errors (see the index's [Targeting](../arcanum-cli.md#targeting)). It gains a `toplevel(repoPath)` method that runs `git -C <path> rev-parse --show-toplevel` through `execFile` with an argument array. The normalization rule itself is in [Command Surface](command-surface.md#--repo-normalization). Owner: `node`.

This was decided while planning #773, not in the issue discussion; reviewers may revisit it.

### Shared agent-email helper

**Findings.**

- The two-key, per-tier resolution already lives in `ConfigChain#read(repoPath, 'git', 'agents.<agent>', 'email')`, the native twin of `config_chain_read`. Only the thin wrapper (`null` → model-email fallback, `{agent}` substitution) is duplicated: three native `_agentEmailGet` copies (`AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan`, `AutoFixIssueCommitChange`) plus `agent_email_get` in `arcanum/_lib/agent_email.sh`.
- The CLI also needs **provenance** (tier and key, e.g. `global git.email`), which none of them exposes.
- **Shell/native divergence on `""`.** Both stop the chain at an explicit empty string. The shell then strips `jq -c`'s quotes, sees an empty value and falls back to the **model email**; native returns `""`, an empty co-author email.

**Decisions.**

1. **`ConfigChain#readWithSource(repoPath, namespace, ...keys)`** returns `{ value, tier, file, key }` or `undefined`. `read` becomes a thin wrapper over it. There is one resolution loop, so value and provenance cannot drift, and `arcanum config get` can show provenance generically.
2. **`shared/lib/config/AgentEmail.js`**, on the shared surface, importing only `ConfigChain`:
   - `resolve(repoPath, agent)` → `{ email, raw, tier, key } | undefined`, where `raw` is the value before `{agent}` substitution. This is the CLI's entry point.
   - `get(repoPath, agent, modelEmail)` → `string`: `resolve` plus the `modelEmail` fallback, with the same verbatim `() => agent` replacer. It replaces the three `_agentEmailGet` copies.
3. **Native aligns to the shell on `""`.** An empty string is *not* an opt-out of the agent co-author line. A resolved empty string means "no email": `get` returns `modelEmail`, and `resolve` still reports the tier and key with `email: undefined`, so the CLI can show e.g. `(model default)  (empty at repo: git.agents.node)`. This is a deliberate native behaviour fix (today a native commit would get an empty co-author email), covered by a spec and called out in the release notes.
4. **The shell side stays.** `agent_email.sh` keeps serving the shell engine. Parity is enforced by one shared fixture table (tier setups → expected email, including `null`, `""`, generic-beats-specific across tiers and `{agent}` substitution), exercised by both the shell and the native specs.
5. **Scope.** Implementation is `node`'s, in the epic #767 implementation issues; this part only records the design. The four `_modelCoauthorOmitted` copies (including `MergeBodyResolver`) are the same kind of duplication, but the CLI does not need them, so they stay off the surface and out of scope.
6. **Edge case: non-string values** (hand edits only). Native stringifies with `String(value)`; the shell prints the `jq -c` form. The [Key Registry](key-registry.md) types `git.email` and `git.agents.*` as strings, so the CLI never writes one. Documented as unsupported, not guaranteed identical.

The CLI view built on `AgentEmail#resolve` is in [Shortcuts and Setup](shortcuts-and-setup.md#resolution).

### Bundle at build time with `esbuild`

The CLI build uses **`esbuild`** to bundle the CLI itself, the shared surface above and the [Key Registry](key-registry.md) into a single self-contained file in the `arcanum-cli` package. `esbuild` is a devDependency only, so the runtime stays zero-dependency. Neither `core/` nor `shared/` is part of the npm package, so the CLI cannot import `shared/lib` at runtime.

Precondition, checked: no shared-surface file uses `import.meta.url` or `__dirname`, so moving them into a bundle breaks no module-relative path resolution.

**Entry and output.**

- Entry: `cli/lib/main.js`, the command router.
- `cli/bin/arcanum` is **not** bundled. It stays the tiny, syntax-conservative Node-floor gate from the index's [Runtime](../arcanum-cli.md#runtime) section, and only then `import('../dist/arcanum.mjs')`s the bundle. An old Node fails at the gate with a clear message, never on newer syntax inside the bundle.
- Output: `cli/dist/arcanum.mjs`, a single file. `dist/` is gitignored.

**Options**, set in `cli/scripts/build.mjs` through esbuild's JS API (not its CLI, so the build can assert on its own output):

| Option | Value | Why |
| --- | --- | --- |
| `bundle` | `true` | |
| `platform` | `'node'` | Built-ins stay external automatically. |
| `format` | `'esm'` | Matches the `"type": "module"` stack. |
| `target` | `node` + the floor parsed from `cli/package.json`'s `engines.node` (`node22.13`) | Derived, not hard-coded, which keeps the index's lockstep rule. |
| `minify` | `false` | Readable stack traces in bug reports; size is irrelevant at ~1–2k lines. |
| `sourcemap` | `false` | Nothing to map without minification. |
| `define` | `__ARCANUM_CLI_VERSION__` from `package.json` | `--version` needs no runtime file read or second JSON import. |
| `metafile` | `true` | Feeds the surface check below. |

**Build-time surface check.** After building, `build.mjs` reads the metafile and **fails** if any bundled input lies outside `cli/lib/**` and `shared/lib/**` (`ALLOWED_INPUT_DIRS`). Both are folders, so there is no file list to keep in sync. This complements the specifier-based lint rule (see [Guardrails](#guardrails)) with a check on resolved paths, at no new dependency.

**`cli/package.json` wiring.** `"build": "node scripts/build.mjs"`; `"prepack": "yarn build"`, so `npm publish`/`npm pack` always ship a fresh bundle; `files: ["bin/", "dist/", "README.md"]`. The CI `cli` job and the release publish job both run `yarn build` (see [CI coupling](#ci-coupling) and [Packaging and Release](packaging-and-release.md#release)).

**Specs.** Regular Jasmine specs and c8 coverage run against the **source** (`cli/spec` → `cli/lib` → `shared/lib` through relative imports). A few **smoke specs** run the built `dist/arcanum.mjs` through `cli/bin/arcanum`: `--version`, a `set`/`get` round-trip in a temp repo, and an unknown-key exit `3`, which proves the registry was inlined. They require `yarn build` first.

**JSON import, to verify during implementation (`node`).** `KeyRegistry.js` loads `keys.json` with a static JSON import (`with { type: 'json' }`), which `esbuild` inlines, so the bundle carries the registry with no runtime file read. Inside **core**, though, it runs unbundled on Node 22.13. If that Node still prints an `ExperimentalWarning` for JSON modules (they were marked stable around 22.12/23.1), the stderr line would break the dispatcher's output contract. The floor CI job would also catch it. **Fallback:** rename `keys.json` → `keys.js` with `export default [...]`. That is transparent to `esbuild`, and the array-of-entries decision in [Key Registry](key-registry.md) is unaffected.

### Guardrails

#### Shared-surface lint rule

The surface is enforced on **both sides**, as described in [Shared Lib → Import boundary](../../architecture/shared-lib.md#import-boundary).

**Surface side: a folder rule.** `shared/eslint.config.mjs` lets every file under `shared/lib/` import only `node:` built-ins and other files under `shared/lib/`. The folder itself is the surface, so the rule needs no file list.

- The allowlist is a negative-lookahead `regex`, not a gitignore-style `group` (`'**'` plus `'!…'` re-includes): under gitignore semantics `**` also excludes the parent segments (`.`, `..`, `node:fs`), which can never be re-included, so such a `group` rejects every import.
- Bare built-ins (`'fs'` instead of `'node:fs'`) are rejected.
- `no-restricted-syntax` covers dynamic `import()`, which `no-restricted-imports` ignores.
- Patterns match the import **specifier**, not the resolved path. Specs catch a wrong path at runtime, and the build's metafile check covers resolved paths.
- The `shared` CI job enforces this side, and `shared/spec/packaging/eslintBoundary_spec.js` covers the rule itself.

**Consumer side.** `cli/eslint.config.mjs` forbids any import from `core/` and any import from `shared/spec/`, so the CLI reaches only `shared/lib/**`. Without it, the CLI could import e.g. `core/lib/context/RepoContext.js`, `esbuild` would bundle it silently, and the surface would be bypassed. The `cli` CI job enforces this side. `core/eslint.config.mjs` likewise forbids `shared/spec/` imports in `core/`.

#### Malformed files stay the CLI's concern

`RepoConfigWriter._readBase` keeps reading a malformed file as `{}`. The CLI refuses to write such a file by checking it itself before calling the writer (see [Command Surface](command-surface.md#missing-and-malformed-tier-files)).

#### CI coupling

**Decision: the CLI job always runs, on every push, with no path filters.**

- **Precedent.** The CircleCI `test` workflow (`test`, `checks`, `mod-checks`) has no path filtering; every job runs on every branch push, docs-only commits included.
- **Cost of path filters on CircleCI.** They need the `path-filtering` orb, a setup workflow generating a continuation config, and "dynamic config" enabled in the project settings: a restructuring of the whole `.circleci/config.yml` for one job.
- **Silent-skip failure mode.** The shared surface is really defined by the import graph `esbuild` follows. A path filter would be a second, hand-maintained copy of that list: add a file to the surface without updating the filter, and the CLI job quietly stops covering it while CI stays green.
- **Cheap job.** Yarn install, lint, a ~1k-line `esbuild` build and the CLI specs, on the order of the existing `checks` job.

Shape:

- A new **`cli` job in the `test` workflow**, owned by `infra` (whose scope gains `.circleci/`, see [Packaging and Release](packaging-and-release.md)). Same image as `test`/`checks` (`darthjee/circleci_node:0.2.1`), `working_directory: ~/project/cli` (the full-repo checkout provides `shared/lib` and the `arcanum/migrations/` files the build reads), tag pushes ignored like its siblings. Steps: `yarn install --frozen-lockfile` → lint → **build the bundle** → CLI specs, including the smoke specs against the built bundle → `yarn audit` (non-blocking, as in `checks`).
- It complements the index's Node 22.13 floor job (see [Runtime](../arcanum-cli.md#runtime)), which runs the same specs at the floor.
- **The bundle is never committed.** It is built in CI and again at publish, so no freshness check is needed. The release pipeline's npm publish job, `publish-cli`, uses **the same build script** as the `cli` job, so the tested artefact is the shipped artefact (see [Packaging and Release](packaging-and-release.md#release)).
- **The reverse direction is already covered.** The surface-side lint rule lives in `shared/eslint.config.mjs`, so the `shared` job enforces it on every push.
- **Revisit** path filtering only if the `cli` job's runtime grows noticeably, as a separate `infra` issue outside epic #767.

## Alternatives considered

- **Keeping the surface in `core/`.** First chosen here, then reversed: epic #816 extracted it into the root `shared/` lib, a plain folder imported by relative path, not an npm or workspace package (see [Shared Lib → Alternatives considered](../../architecture/shared-lib.md#alternatives-considered)).
- **A plain copy script instead of `esbuild`.** Rejected: copied files keep their relative imports and need their own module layout in the package, whereas a bundle is one self-contained file.
- **Reimplementing the config logic in the CLI.** Rejected: it would drift from arcanum, especially the locking.
- **Importing `shared/lib` at runtime.** Impossible: `shared/` is not shipped in the npm package.
- **Path-filtered CI for the CLI job.** Rejected: it needs CircleCI dynamic config, and a hand-maintained filter can silently stop covering a new surface file.
- **A CLI-only, stricter lock.** Rejected: it would not exclude running skills, which use the shared protocol. The shared protocol is fixed instead (#807).
- **Keeping `BooleanKeyConfig` on the surface.** Rejected: it is the `config.sh` dispatch layer, and it drags `DispatchFailure` in.
- **A path-resolving lint via `eslint-plugin-import`.** Rejected: a new devDependency, while the build's metafile check already covers resolved paths.

## Backward compatibility, testing and security

**Backward compatibility:**

- Dispatcher output and exit codes stay byte-identical: `ConfigError extends Error` with the same messages.
- One deliberate change: a native `""` agent email now falls back to the model email, aligned with the shell. Called out in the release notes.
- #807 is safe alongside old-protocol writers (see [Lock](#lock)).
- No migration is needed: no config or state file changes shape.

**Testing:**

- Source specs with c8 coverage; smoke specs on the built bundle; the build's metafile surface check.
- Shell/native agent-email parity fixtures.
- A spec per `ConfigError` code.
- CI on the default image (the `cli` job) plus the Node 22.13 floor job.

**Performance and security:**

- With #807, an uncontended lock is immediate instead of a fixed 1s.
- The bundle is unminified, with zero runtime dependencies; the supply-chain surface is limited to the `esbuild` devDependency.
- The CLI-side lint and the metafile check stop the bundle from silently pulling in anything outside `cli/lib` and `shared/lib`.

## Open points

None left. The extraction into `shared/` was done in epic #816.

## Dependencies

- **#807** (lock protocol fix): hard blocker for the CLI's write commands (see [Lock](#lock)).
