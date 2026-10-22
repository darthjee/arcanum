# Arcanum CLI: Packaging and Release

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define where the CLI code lives, how it is packaged as the `arcanum-cli` npm package, and how it is released.

## Decisions

### Code layout

The code lives in a new root-level folder, **`cli/`**, owned by the `client` agent (see [Ownership](../arcanum-cli.md#ownership)):

| Path | Contents |
| --- | --- |
| `cli/bin/arcanum` | the npm `bin` entry: the unbundled Node-floor gate |
| `cli/lib/` | CLI source; `cli/lib/main.js` is the bundle entry |
| `cli/scripts/build.mjs` | the `esbuild` build, the embedded migration-version list, and the metafile shared-surface check |
| `cli/dist/` | the bundle output, `arcanum.mjs`; gitignored, never committed |
| `cli/spec/` | Jasmine specs mirroring `cli/lib/` one to one, with c8 coverage, plus the smoke and packaging specs below |
| `cli/package.json` | package manifest |
| `cli/yarn.lock` | committed lockfile for the devDependencies |
| `cli/eslint.config.mjs` | lint config, same style rules as `core/` |
| `cli/README.md` | developer README, also the npm package page |

The stack mirrors `core/`: Node.js ESM, Yarn, Jasmine, c8, ESLint.

`cli/` is **not** part of the release zip. `scripts/build_release_zip.sh`'s `FILES` array does not list it, so arcanum installs never carry a CLI copy (see the alternative rejected below). A `core/spec` packaging check on `build_release_zip.sh --list` asserts that no `cli/` path is packaged, the same way it already checks the `arcanum-next-step/` mod (see [Install and Release](../../architecture/install-and-release.md)).

### `cli/package.json`

| Field | Value | Why |
| --- | --- | --- |
| `name` | `"arcanum-cli"` | Unscoped, so the install command is `npm i -g arcanum-cli`. |
| `version` | arcanum's version, e.g. `"2.4.0"` | Lockstep; see [Version lockstep](#version-lockstep). |
| `description`, `homepage`, `repository`, `bugs` | arcanum's values; `repository.directory: "cli"` | The npm page links back to this repo and folder. The repo has no license file today, so there is no `license` field; if one is added, the field and a `cli/LICENSE` copy follow. |
| `type` | `"module"` | ESM, like `core/`. |
| `bin` | `{"arcanum": "bin/arcanum"}` | The installed command is `arcanum`. |
| `files` | `["bin/", "dist/", "README.md"]` | Whitelist. Sources, specs, the build script and the lockfile never ship. npm always adds `package.json`. |
| `engines.node` | `">=22.13.0"` | Equal to `core/package.json`'s, enforced by a spec (see the index's [Runtime](../arcanum-cli.md#runtime)). |
| `scripts` | `build`, `prepack: "yarn build"`, `test`, `lint` | `npm publish`/`npm pack` always ship a fresh bundle. |
| `dependencies` | none (the field is absent) | Zero runtime dependencies. |
| `devDependencies` | Jasmine, c8, ESLint (and the plugins `core/` uses), `esbuild` | Exact versions (no `^`), pinned by `cli/yarn.lock`. |
| `publishConfig` | `{"access": "public", "tag": "latest"}` | Explicit, so a local `npm publish` cannot pick another dist-tag by accident. |

No other lifecycle scripts. In particular `preinstall`, `install` and `postinstall` are **forbidden**: installing the package must never run code. A packaging spec asserts that the manifest has no such script and no `dependencies`, `optionalDependencies` or `peerDependencies`.

`private` is absent. The `test`/`checks` workflows never publish, and only the release job holds the npm token (see [Token storage](#token-storage)).

### Build output

`yarn build` (`cli/scripts/build.mjs`) produces one file, `cli/dist/arcanum.mjs`, containing:

- the CLI (`cli/lib/**`);
- the shared config surface from `shared/lib` (see [Shared Config Logic](shared-config-logic.md#source-lives-in-shared));
- the [Key Registry](key-registry.md) (`keys.json`, inlined by the JSON import);
- the CLI version, injected through `define` as `__ARCANUM_CLI_VERSION__`;
- the embedded migration-version list (below).

The `esbuild` options, the metafile surface check and the smoke specs are in [Shared Config Logic](shared-config-logic.md#bundle-at-build-time-with-esbuild). The bundle is unminified, so a user can read what they installed, and a bug report's stack trace points at real source lines.

`cli/bin/arcanum` is not bundled. It is a short, syntax-conservative file that checks the Node floor (see the index's [Runtime](../arcanum-cli.md#runtime)) and only then dynamically imports `../dist/arcanum.mjs`. It carries the floor as a literal; a spec asserts it equals `engines.node`, so the three copies (`core/package.json`, `cli/package.json`, `cli/bin/arcanum`) cannot drift.

#### Embedded migration-version list

The index's [Version skew](../arcanum-cli.md#version-skew) needs to know, per scope, which arcanum versions shipped migrations. `build.mjs` computes this at build time and injects it through `define` as `__ARCANUM_MIGRATION_VERSIONS__`:

```json
{
  "repo":   ["0.13.0", "0.14.0", "0.16.0", "..."],
  "local":  ["0.13.0", "0.14.0", "0.15.0", "..."],
  "global": ["0.15.0", "0.16.0", "1.0.1", "..."]
}
```

Rules:

- **Source.** Every `arcanum/migrations/repos/<dir>/migrations.json`, read-only. A version is listed under a scope when at least one of its entries has that `applies_to`.
- **Released versions only.** Only directories whose name is a bare `X.Y.Z` count. `next/` holds unreleased migrations and is skipped. At release time `scripts/bump-version.sh` has already rolled `next/` into `<version>/`, so a released bundle never misses its own migrations.
- **Upper bound.** Versions greater than the CLI's own version are dropped. They cannot exist in a release build, but a development build on a branch must not report migrations "from the future".
- **Order.** Each list is sorted by semver, not by string (`0.9.3` < `0.13.0`).
- **Validation.** The build fails on a `migrations.json` that is not a JSON array, or on an entry whose `applies_to` is missing or not `repo`, `local` or `global`. It does not guess a scope.
- **Use.** "N pending" for a tier is the number of listed versions `v` with `pointer < v <= cliVersion` in that tier's scope. The CLI counts versions, not individual migration entries. That is enough for "is anything pending" and for the `info` count, and it keeps the bundle small.

Owner: `client`. The list is data inside the bundle; the CLI never reads `arcanum/migrations/` at runtime, since it is not shipped in the package.

### Install

- `npm i -g arcanum-cli`. npm handles PATH, updates and uninstall, so there is no custom installer.
- `npx arcanum-cli config info` works too, with no global install. It is documented as a one-off way to inspect the environment, not as the main path.
- The CLI is optional. No per-repo migration installs it or nudges the user to.

### Release

The package is published from the existing CircleCI `release` workflow (see [Install and Release](../../architecture/install-and-release.md)), on the same `X.Y.Z` tag as arcanum.

**Job `publish-cli`**, owned by `infra`:

- In the `release` workflow, with the same tag filters as its siblings (`branches: ignore: /.*/`, `tags: only: /^\d+\.\d+\.\d+$/`).
- `requires: [build-and-release]`, and runs in parallel with `publish-image`. The GitHub release is arcanum's canonical artefact, so the CLI is only published once it exists. A failing `publish-image` does not hold back the CLI, and vice versa.
- Image: the same `darthjee/circleci_node` image as the `cli` test job, `working_directory: ~/project/cli`, with the full-repo checkout (the build needs `shared/lib` and `arcanum/migrations/`).
- Steps, each failing the job on error:
  1. **Version check:** `cli/package.json`'s `version` must equal `$CIRCLE_TAG` (see [Version lockstep](#version-lockstep)).
  2. **Already published?** If `npm view arcanum-cli@$CIRCLE_TAG version` returns the version, stop with success (see [Failure handling](#failure-handling)).
  3. `yarn install --frozen-lockfile`.
  4. `yarn lint`, then `yarn build`, then the CLI specs including the smoke specs on the bundle. The `test` workflow ignores tag pushes, so the release job runs them itself, on the exact tree it publishes.
  5. **Content check:** `npm pack --dry-run --json`, asserting the file list is exactly `bin/arcanum`, `dist/arcanum.mjs`, `README.md` and `package.json`.
  6. `npm publish`, through a temporary `.npmrc` (see [Token storage](#token-storage)).
  7. **Verify:** `npm view arcanum-cli@$CIRCLE_TAG version` returns the tag, retried for up to a minute to absorb registry lag.
- The steps live in a script, `scripts/publish_cli_package.sh <tag>` (owner: `infra`), like `scripts/publish_runtime_image.sh`, so the job's YAML stays a single call and the logic is testable locally against a dry run (`--dry-run` maps to `npm publish --dry-run` and skips steps 2 and 7).
- `prepack` rebuilds the bundle during `npm publish`. That is the same `yarn build` as step 4 on the same tree, so the tested artefact is the shipped artefact (see [Shared Config Logic](shared-config-logic.md#ci-coupling)).

#### Version lockstep

The CLI version always equals the arcanum version it was released with. The index's [Version skew](../arcanum-cli.md#version-skew) relies on this: the CLI compares tier pointers, which hold arcanum versions, with its own version.

- **Bump.** `scripts/bump-version.sh` also rewrites `cli/package.json`'s `version`, in the same run that updates `arcanum.version`. Owner of that script change: `infra`, with the release pipeline.
- **Push-time guard.** A `cli/` spec asserts that `cli/package.json`'s `version` equals the root `arcanum.version`. The `cli` CI job runs on every push, so a hand edit to either file fails CI before a tag exists.
- **Tag-time guard.** `publish-cli`'s first step (above) refuses to publish when `cli/package.json` disagrees with the tag. Nothing is published under the wrong version.
- **Every release publishes.** The CLI is published on every arcanum release, even when nothing under `cli/` or the shared surface changed. That keeps "CLI version = newest arcanum version" true, which the skew check depends on. Release notes say so for releases with no CLI change.

#### Token storage

- **`NPM_TOKEN`**, a CircleCI project (or context) environment variable, documented in `.circleci/config.yml`'s header next to `GH_TOKEN` and `DOCKERHUB_TOKEN`.
- It is an npm **granular access token** with read-and-write permission on the `arcanum-cli` package only, an expiry date, and "bypass 2FA" enabled (CI cannot answer an OTP). The package owner account keeps 2FA on for interactive logins.
- It is never echoed. `publish_cli_package.sh` writes a temporary `.npmrc` containing the literal `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`, so npm expands the variable itself and the value never appears on a command line or in the log. The file is created with mode `600` outside the checkout and removed by an `EXIT` trap. The script runs with `set +x`.
- The token exists only in the `release` workflow. The `test` workflow's jobs never receive it. When it is held in a CircleCI context, the context is restricted to the `release` workflow's jobs.
- **Rotation.** The token's expiry is at most one year. Rotating it is a CircleCI settings change, with no code change. An expired token fails the publish step with npm's `E401`/`E403`; see [Failure handling](#failure-handling).

#### Provenance

**Decision: publish without `--provenance` for now; adopt npm trusted publishing with provenance once npm supports CircleCI as an OIDC provider.**

- `npm publish --provenance` needs a CI provider that npm accepts as an OIDC identity source. npm launched this for GitHub Actions and GitLab CI/CD; arcanum releases from CircleCI.
- The `infra` sub-issue checks npm's current list of trusted-publisher providers when it implements `publish-cli`. If CircleCI is on it, the job uses trusted publishing instead of `NPM_TOKEN` (no long-lived secret at all) and publishes with provenance, and this section is updated.
- Until then, the same tarball integrity is available through other means: the `npm pack` file list is checked (step 5), and the published tarball's `dist.integrity` is printed by the verify step. It can be compared with a local `npm pack` of the same tag.
- Moving the publish job to GitHub Actions only to get provenance is rejected (see [Alternatives considered](#alternatives-considered)).

#### Failure handling

npm versions are **immutable**: a published `arcanum-cli@X.Y.Z` cannot be overwritten, and its version number can never be reused, even after an unpublish. The release flow follows from that:

- **Order.** `build-and-release` (the GitHub release) runs first; `publish-cli` and `publish-image` run after it, in parallel. A failed npm publish therefore leaves a GitHub release with no matching CLI. That is the safe direction: arcanum installs work as before, and the CLI is optional.
- **Recovery.** Fix the cause (usually an expired or revoked token) and use CircleCI's "Rerun workflow from failed". `build-and-release` is already idempotent (`upload_release_asset.sh` creates or updates the release), so only the failed jobs redo work.
- **Re-runs are a no-op once published.** Step 2 stops with success when the version already exists on the registry. Unlike `publish-image`, which must fail on an existing tag because Docker tags can be overwritten, npm itself guarantees the published version cannot change, so skipping is safe and makes a whole-workflow re-run usable.
- **Partial publish is impossible.** `npm publish` uploads one tarball in one request: the version either exists or it does not.
- **A broken published version** is never unpublished. It is fixed by a new arcanum patch release (which publishes a new CLI version) plus `npm deprecate arcanum-cli@X.Y.Z "<reason>; upgrade to X.Y.Z+1"`, run by hand by the package owner.
- **Effect of a lagging CLI.** While the publish is missing, the newest CLI on npm is the previous version. Users who already migrated to the new arcanum version see their tiers as "ahead", so reads warn and writes are refused without `--force` (see the index's [Version skew](../arcanum-cli.md#version-skew)). That is the designed fail-safe, not a data risk, and it ends when the re-run publishes.

#### Dist-tags

**Decision: every publish goes to `latest`; there is no pre-release channel.**

- The `release` workflow only triggers on bare `X.Y.Z` tags, so a pre-release tag such as `2.4.0-rc.1` never reaches `publish-cli`.
- `publishConfig.tag` is pinned to `latest`, and the version check (step 1) rejects anything that is not bare `X.Y.Z`.
- A pre-release channel (publishing `X.Y.Z-rc.N` under `next`) is future work. It would need the `release` workflow to accept pre-release tags for the zip and the image too, which is a decision for the whole release pipeline, not for the CLI alone.

### Local tooling

Docker, docker-compose and Makefile `cli-*` targets for running the CLI specs, the build and a dry-run publish (`scripts/publish_cli_package.sh <version> --dry-run`) are owned by `infra`.

### Supply chain

What a user installs, and what can reach it:

- **Zero runtime dependencies.** `npm i -g arcanum-cli` installs exactly one package; nothing else is resolved from the registry.
- **No install-time code.** No `preinstall`/`install`/`postinstall` scripts (enforced by a packaging spec).
- **Readable bundle.** `dist/arcanum.mjs` is unminified, so what runs is what can be read in the package.
- **Bounded build inputs.** The metafile check fails the build if anything outside `cli/lib/**` and `shared/lib/**` gets bundled (see [Shared Config Logic](shared-config-logic.md#bundle-at-build-time-with-esbuild)). The devDependencies, including `esbuild`, run only at build time and are pinned by `cli/yarn.lock` with exact versions; the release job installs with `--frozen-lockfile`.
- **Whitelisted contents.** `files` plus the `npm pack --dry-run` check (step 5) mean no source, spec, lockfile or stray local file is published.
- **Narrow credentials.** The npm token is scoped to one package, expires, lives only in the `release` workflow, and is never printed (see [Token storage](#token-storage)).
- **Audit.** The `cli` CI job runs `yarn audit` as a non-blocking step, like the `checks` job does for `core/`. It only covers devDependencies, since there are no runtime ones.

## Edge cases

| Case | Behaviour |
| --- | --- |
| `cli/package.json` version ≠ tag | `publish-cli` fails at step 1; nothing is published. The push-time spec should have caught it earlier. |
| Tag pushed again / workflow re-run after a successful publish | Step 2 finds the version on npm and exits with success. |
| npm token missing, expired or revoked | `publish-cli` fails (`NPM_TOKEN` unset is checked before any npm call, like `publish-image`'s `DOCKERHUB_TOKEN` check). Rotate the token and re-run from failed. |
| Registry outage or lag after publish | The verify step retries for a minute, then fails. A re-run finds the version published and stops at step 2. |
| `next/` contains migrations at tag time | Cannot happen through `bump-version.sh`. If it happens anyway, the build ignores `next/`, so those migrations are not counted, and the release itself is wrong for arcanum too, not just the CLI. |
| A `migrations.json` has an entry without a valid `applies_to` | The build fails, on the `cli` job at push time and again at release. |
| A release with no CLI change | Published anyway, so the version stays in lockstep. |
| User on an older CLI than their repo | The skew warning suggests `npm i -g arcanum-cli@latest`; writes need `--force` (see the index). |
| User on Node below the floor | `cli/bin/arcanum` prints the required version and exits `1`; npm only warns at install time unless `engine-strict` is set. |
| `npx arcanum-cli` with a cached older version | npx may run the cached version. The skew warning applies the same way; `npx arcanum-cli@latest` forces the newest. |

## Backward compatibility

- The CLI is a new, optional package. Nothing that exists today depends on it, and arcanum installs do not change: `cli/` is not in the release zip, and no per-repo migration is added.
- The release workflow only gains a job. `build-and-release` and `publish-image` are unchanged, and a `publish-cli` failure cannot fail or roll back either of them.
- `scripts/bump-version.sh` gains one more file to rewrite. Its existing outputs (`arcanum.version`, the bootstrap default, README, the migrations roll-over and the regenerated docs) are unchanged.
- Once published, a version is permanent. Changes to the CLI's behaviour ship as new arcanum versions; older CLI versions keep working against the tier files through the skew rules.
- **Raising the Node floor** follows `core` and is a breaking change for both (see the index's [Runtime](../arcanum-cli.md#runtime)). npm users on an older Node keep the last CLI version that supported it, since npm's `engines` check only warns; the `bin/arcanum` gate makes the failure explicit.

## Testing strategy

All owned by `client` unless stated otherwise.

- **Manifest spec:** `name`, `bin`, `files`, `type`, `publishConfig`; no `dependencies`/`optionalDependencies`/`peerDependencies`; no install lifecycle scripts; exact devDependency versions.
- **Lockstep specs:** `cli/package.json` `version` equals `arcanum.version`; `engines.node` equals `core/package.json`'s; the floor literal in `cli/bin/arcanum` equals `engines.node`.
- **Migration-list specs:** against fixture `repos/` trees in a temp dir: `next/` skipped, non-semver directory names skipped, semver ordering (`0.9.3` before `0.13.0`), versions above the CLI version dropped, scope assignment by `applies_to`, and a build failure on an invalid or missing `applies_to`. Plus one spec against the real `arcanum/migrations/repos/` asserting the build succeeds, so a bad migration file fails the `cli` job.
- **Smoke specs** on the built bundle (see [Shared Config Logic](shared-config-logic.md#bundle-at-build-time-with-esbuild)), extended with `info` reporting a pending count computed from the embedded list.
- **Packaging spec:** `npm pack --dry-run --json` lists exactly the expected files.
- **Floor job:** the `cli/` specs also run on Node 22.13 exactly (`infra`, see the index's [Runtime](../arcanum-cli.md#runtime)).
- **Release script (`infra`):** `scripts/publish_cli_package.sh --dry-run` exercised locally through the Makefile target; the version check and the "already published" short-circuit are testable by pointing the script at a fake `npm` on PATH, like the existing root `scripts/test_*.sh` scripts.
- **Release zip (`node`, in `core/spec`):** no `cli/` path in `build_release_zip.sh --list`.

## Performance

Nothing load-sensitive. The package is a single unminified file of roughly 1–2k lines plus the registry and a short version list. Install is one tarball download with no dependency resolution. Start-up is one Node process, one dynamic import and one `git rev-parse` (see the index). The `publish-cli` job adds a few minutes to the release workflow, in parallel with `publish-image`, so it does not lengthen the critical path.

## Security

- No install-time code, zero runtime dependencies, and a whitelisted, checked package content (see [Supply chain](#supply-chain)).
- The npm token is package-scoped, expiring, release-only, and never printed or placed on a command line (see [Token storage](#token-storage)).
- Published versions are immutable and never unpublished; a bad version is deprecated and superseded (see [Failure handling](#failure-handling)).
- The CLI never reads `arcanum/migrations/` or any network resource at runtime; the migration-version list is baked into the bundle.
- `cli/bin/arcanum` only imports the bundle shipped next to it, by a relative path; it never resolves code from the current directory.

## Alternatives considered

- **A release-zip tarball with its own `curl | bash` bootstrap.** Rejected: arcanum would have to own PATH handling, updates and uninstall, which npm already does.
- **A standalone binary via `bun build --compile` or `pkg`.** Rejected: it needs per-OS builds and heavier CI.
- **Shipping the CLI inside each arcanum install, plus a PATH migration.** Rejected: users with several installs would get several competing clients.
- **Publishing from GitHub Actions to get npm provenance today.** Rejected: it splits the release pipeline across two CI providers for one job, and the GitHub release, the image and the npm package would no longer come from one workflow run.
- **Publishing the CLI before the GitHub release.** Rejected: the GitHub release is arcanum's canonical artefact. A CLI published for a release that then fails would describe a version that does not exist.
- **Publishing only when `cli/` or the shared surface changed.** Rejected: the CLI version would lag arcanum's, and the skew check would refuse writes to freshly migrated tiers.
- **Failing `publish-cli` when the version already exists**, like `publish-image`. Rejected: npm already guarantees immutability, so failing would only block whole-workflow re-runs.
- **Reading `arcanum/migrations/` at runtime.** Impossible: it is not in the npm package, and the CLI does not locate arcanum installs (see the index's Version skew alternatives).

## Open points

None left. Future work:

- Switch to npm trusted publishing with provenance once npm accepts CircleCI as an OIDC provider (see [Provenance](#provenance)).
- A pre-release channel under the `next` dist-tag, decided together with pre-release tags for the whole release pipeline (see [Dist-tags](#dist-tags)).
