# Install & Release Pipeline

Besides `git clone`, arcanum can be installed via a `curl | bash` one-liner, in two stages:

1. **Bootstrap** (`arcanum/install/bootstrap.sh`) — fetched directly via `curl` from the `main` branch. Resolves `ARCANUM_REPO` (default `darthjee/arcanum`) and `ARCANUM_VERSION` (default: the version embedded in the script itself, updated by `scripts/bump-version.sh`), downloads the corresponding release zip, unpacks it into a temporary directory, and hands control to the installer inside it. Exports `REPO`/`VERSION` to the process that replaces it via `exec`, since the installer needs both to write `arcanum.json`. Deliberately kept small and auditable, since it's the only piece executed blindly.
2. **Installer** (`arcanum/install/installer.sh`) — ships inside the release zip (and also in a plain `git clone`), versioned together with the release that installs it. Checks whether an `arcanum.json` already exists in the target directory (if so, refuses and recommends running `update` instead of reinstalling), interactively asks for the destination directory (reading from `/dev/tty`, since stdin under `curl | bash` is the script's own content), copies the skill folders + `arcanum/` to the confirmed destination, and writes `arcanum.json` (version/repo/manifest) based on the received `REPO`/`VERSION` variables and the `MANIFEST` file embedded in the zip.

The release zip is assembled by `scripts/build_release_zip.sh` (a development tool, not included in the zip itself) and published by the CircleCI pipeline (`.circleci/config.yml`) as a GitHub Release asset, triggered on a semver tag push (the same `X.Y.Z` pattern already used by the repository's existing tags). The zip includes a `MANIFEST` file (a list of every packaged path, one per line, generated from the same `FILES` array used to assemble the zip) at the root of the tree, used by both the installer and the updater to reconcile installations without depending on `git`. Running `scripts/build_release_zip.sh --list` prints that same path list, one per line, without building anything (no zip, no output directory, no `MANIFEST` file). `core/spec` uses it to check what gets packaged, e.g. that the `arcanum-next-step/` mod ships while its engine-generated `.claude-plugin/types/` does not.

Spec folders (`core/spec/`, `shared/spec/`) are dev-only and never packaged: both are listed in `build_release_zip.sh`'s `EXCLUDES`, and the `--list` packaging spec (`core/spec/release/buildReleaseZipList_spec.js`) asserts that no listed path matches `(^|/)spec/`. Existing zip installs drop `core/spec/` on their next update, through the updater's `MANIFEST` diff; git-clone installs keep the full tree by design.

CI, lint and test tooling is dev-only too and listed in `EXCLUDES`: `.circleci/`, `.codacy.yml`, the markdownlint files, the root `Makefile`, `core/eslint.config.mjs`, `core/.jscpd.json`, `core/docker-compose.yml`, `shared/eslint.config.mjs`, and the mod's `hooks/*.test.ts`, `hooks/test-support.ts` and `tsconfig.json`; `arcanum.png` (the README loads it from a remote URL) is excluded as well. An `EXCLUDES` entry containing `*` is a glob, matched with bash pattern matching. Some Docker files keep shipping on purpose: `core/Dockerfile` and `.dockerignore` (the docker engine's local-build fallback) and `core/docker-entrypoint.sh` (the `test` stage `COPY`s it, and the legacy builder builds that stage even with `--target runtime`), along with `core/package.json`, `core/yarn.lock` and `README.md`. The packaging spec guards both sides: excluded paths must not be listed, kept ones must be. Existing zip installs drop the excluded files on their next update, through the `MANIFEST` diff.

After the zip is uploaded, the same `release` workflow also publishes the multi-arch runtime Docker image `darthjee/arcanum:<version>` (job `publish-image`), used by `engine.mode=docker`. See [Docker Engine → Distribution and versioning](docker-engine.md#distribution-and-versioning). In parallel, it publishes the `arcanum-cli` npm package (job `publish-cli`); see [npm package (arcanum-cli)](#npm-package-arcanum-cli).

## npm package (arcanum-cli)

The same `release` workflow publishes the `arcanum-cli` npm package (the `cli/` client, see [Arcanum CLI](arcanum-cli.md)) as `arcanum-cli@<version>`, on every release tag.

### Code layout

The CLI lives in the root folder `cli/`, owned by `client`. The stack mirrors `core/`: Node.js ESM, Yarn, Jasmine, c8 and ESLint.

| Path | Contents |
| --- | --- |
| `cli/bin/arcanum` | The npm `bin` entry: the unbundled Node-floor gate |
| `cli/lib/` | The CLI source; `cli/lib/main.js` is the bundle entry |
| `cli/scripts/build.mjs` | The `esbuild` build, the embedded migration-version list and the metafile check |
| `cli/dist/` | The bundle, `arcanum.mjs`; gitignored, never committed |
| `cli/spec/` | Jasmine specs mirroring `cli/lib/`, plus the `bin`, build, packaging and smoke specs |
| `cli/package.json`, `cli/yarn.lock` | The manifest and the committed lockfile for the devDependencies |
| `cli/eslint.config.mjs` | The lint config, with the CLI side of the [import boundary](shared-lib.md#import-boundary) |
| `cli/README.md` | The developer README, which is also the npm package page |

`cli/` is **not** part of the release zip: it is in `build_release_zip.sh`'s `EXCLUDES`, so arcanum installs never carry a copy of the CLI. `core/spec/release/buildReleaseZipList_spec.js` asserts that `--list` names nothing under `cli/`.

### Package manifest

| Field | Value | Why |
| --- | --- | --- |
| `name` | `arcanum-cli` | Unscoped, so the install is `npm i -g arcanum-cli`. |
| `version` | arcanum's version | Lockstep, see [Version lockstep](#version-lockstep). |
| `description`, `homepage`, `repository` (with `directory: "cli"`), `bugs` | arcanum's values | The npm page links back to this repo and folder. The repo has no license file, so there is no `license` field. |
| `type` | `module` | ESM, like `core/`. |
| `bin` | `{"arcanum": "bin/arcanum"}` | The installed command is `arcanum`. |
| `files` | `["bin/", "dist/", "README.md"]` | A whitelist: sources, specs, the build script and the lockfile never ship. npm always adds `package.json`. |
| `engines.node` | `>=22.13.0` | Equal to `core/package.json`'s. |
| `scripts` | `build`, `prepack: "yarn build"`, `test`, `lint` | `npm pack` and `npm publish` always ship a fresh bundle. |
| `dependencies` | absent | Zero runtime dependencies. |
| `devDependencies` | Jasmine, c8, ESLint and its plugins, `esbuild` | Exact versions, pinned by `cli/yarn.lock`. |
| `publishConfig` | `{"access": "public", "tag": "latest"}` | A local `npm publish` cannot pick another dist-tag by accident. |

There are no other lifecycle scripts. `preinstall`, `install` and `postinstall` are forbidden: installing the package never runs code. `private` is absent; only the release job publishes. `cli/spec/packaging/manifest_spec.js` asserts the shape: the name and `bin`, no `dependencies` / `optionalDependencies` / `peerDependencies`, no install scripts, exact devDependency versions, the wired scripts, and an `npm pack --dry-run` file list of exactly `README.md`, `bin/arcanum`, `dist/arcanum.mjs` and `package.json`.

### Build output

`yarn build` (`cli/scripts/build.mjs`) writes one file, `cli/dist/arcanum.mjs`. It holds the CLI (`cli/lib/**`), the parts of `shared/lib/` it imports, `keys.json` (inlined by its JSON import), and three constants injected through `define`: `__ARCANUM_CLI_VERSION__` (`version`), `__ARCANUM_NODE_FLOOR__` (`engines.node`) and `__ARCANUM_MIGRATION_VERSIONS__` (below). The bundle is unminified, so a user can read what they installed and stack traces point at real source lines. Its `esbuild` target is derived from `engines.node` (`node22.13`), and the build fails if any bundled input lies outside `cli/lib/**` and `shared/lib/**` (see [Shared Lib → The CLI bundle](shared-lib.md#the-cli-bundle)). The CLI's runtime path, from the `bin/arcanum` gate to the bundle, is in [Arcanum CLI → Runtime path](arcanum-cli.md#runtime-path).

**The embedded migration-version list.** The CLI's version-skew check needs to know, per scope, which arcanum versions shipped migrations. `build.mjs` computes it at build time:

```json
{"repo": ["0.9.3", "0.13.0", "..."], "local": ["..."], "global": ["..."]}
```

- **Source:** every `arcanum/migrations/repos/<X.Y.Z>/migrations.json`, read-only. A version is listed under a scope when at least one of its entries has that `applies_to`.
- **Released versions only.** Only bare `X.Y.Z` directories count; `next/` and directories without a `migrations.json` are skipped. At release time `scripts/bump-version.sh` has already rolled `next/` into the version's folder, so a released bundle never misses its own migrations.
- **Upper bound.** Versions above the CLI's own are dropped, so a development build never reports migrations "from the future".
- **Order:** each list is sorted by semver, not as strings (`0.9.3` < `0.13.0`).
- **Validation.** The build fails on a `migrations.json` that is not a JSON array, or on an entry whose `applies_to` is missing or not `repo`, `local` or `global`. It never guesses a scope.

The list is data inside the bundle: the CLI never reads `arcanum/migrations/` at runtime, since it is not in the package. How the CLI counts pending migrations from it is in [Arcanum CLI → Version skew](arcanum-cli.md#version-skew).

### Install

- `npm i -g arcanum-cli`. npm handles PATH, updates and uninstall, so there is no custom installer.
- `npx arcanum-cli config info` works with no global install, as a one-off way to inspect an environment.
- The CLI is optional, and the installer and updater offer it.
- The global migration `arcanum/migrations/repos/next/001.sh` offers it once per machine or account. It is skippable, pins the client to the installed arcanum version, and calls the shared client step with `--no-confirm` (choosing `[R]un` is the consent). On any failure it warns and continues (exit `0`). See [CLI Install → update.md](../specs/cli-install/update.md#global-migration-next001).

### Version lockstep

The CLI's version always equals the arcanum version it was released with. The CLI's skew check relies on it: it compares the tiers' version pointers, which hold arcanum versions, with its own version.

- **Bump.** `scripts/bump-version.sh` also rewrites `cli/package.json`'s `version`, in the same run that updates `arcanum.version`.
- **Push-time guard.** `cli/spec/packaging/lockstep_spec.js` asserts that `cli/package.json`'s `version` equals the root `arcanum.version`, that `engines.node` equals `core/package.json`'s, and that the floor literal in `cli/bin/arcanum` (and the source-run fallback) equals `engines.node`. The `cli` CI job runs on every push, so a hand edit fails CI before a tag exists.
- **Tag-time guard.** `publish_cli_package.sh` refuses to publish when `cli/package.json` disagrees with the tag (step 1 below).
- **Every release publishes**, even when nothing under `cli/` or `shared/` changed, so "CLI version = newest arcanum version" stays true.

### Job and script

- **Job `publish-cli`** (`.circleci/config.yml`): release-only, with the same tag filters as its siblings. It `requires: [build-and-release]` and runs in parallel with `publish-image`, so the GitHub release always exists first and a failure in one publish job does not hold back the other. It runs on `darthjee/circleci_node` (the `cli` test job's image) from `cli/` in a full checkout. That image's npm is older than trusted publishing needs, so the job first installs an exact npm 11.x pin, then makes one call to `scripts/publish_cli_package.sh "$CIRCLE_TAG"`.
- **Script `scripts/publish_cli_package.sh <tag> [--dry-run]`.** Each step fails the job on error:
  0. Preflight: the tag is a bare `X.Y.Z` and Node is ≥ 22.14.0. For a real publish, npm must also be ≥ 11.5.1, `NPM_TOKEN`/`NODE_AUTH_TOKEN` must be unset, and the `circleci` CLI must be present (it mints the OIDC token in step 6).
  1. `cli/package.json`'s `version` equals the tag.
  2. If `arcanum-cli@<tag>` is already on the registry, stop with success.
  3. `yarn install --frozen-lockfile`.
  4. `yarn lint`, `yarn build`, `yarn test`.
  5. The `npm pack --dry-run` file list is exactly `README.md`, `bin/arcanum`, `dist/arcanum.mjs` and `package.json`.
  6. Mint an npm-audience OIDC token, export it as `NPM_ID_TOKEN`, and run `npm publish` (`publishConfig` pins `access: public` and `tag: latest`).
  7. Poll the registry for up to a minute until the version is visible, then print its `dist.integrity`.
- **Dry run.** `--dry-run` skips steps 2 and 7, replaces step 6 with `npm publish --dry-run`, and needs no OIDC token and no npm 11. Run it locally with `make cli-publish-dry-run` (inside the `cli` compose service; `VERSION` defaults to `cli/package.json`'s). The script's own regression check is `bash scripts/test_publish_cli_package.sh`, run by hand.

### npm trusted publishing

`publish-cli` authenticates with **npm trusted publishing** over CircleCI OIDC. Just before `npm publish`, the script mints a token with the npm audience, `circleci run oidc get --claims '{"aud": "npm:registry.npmjs.org"}'`, and exports it as `NPM_ID_TOKEN`. npm exchanges it for a short-lived publish credential. npm does not use CircleCI's default `CIRCLE_OIDC_TOKEN_V2`: its audience is the CircleCI organization ID, not npm. Without `NPM_ID_TOKEN`, `npm publish` fails with `ENEEDAUTH`. There is no long-lived npm token anywhere: no `NPM_TOKEN` env var, no CircleCI context, no `.npmrc` auth line. The script refuses a real publish when `NPM_TOKEN` or `NODE_AUTH_TOKEN` is set, so a stray token cannot silently bypass trusted publishing. Trusted publishing needs npm ≥ 11.5.1 and Node ≥ 22.14.0.

**No provenance.** npm does not generate provenance for packages published from CircleCI ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)), so no `arcanum-cli` version carries a provenance attestation. The verify step also prints the published tarball's `dist.integrity`, which can be compared with a local `npm pack` of the same tag. The OIDC identity only exists in CircleCI jobs, and only `publish-cli` calls `npm publish`; the `test` workflow never publishes. The script runs without `set -x`.

**One-time bootstrap**, done by hand by the package owner. A trusted publisher can only be attached to a package that exists, so until this is done every `publish-cli` run fails at the publish step:

1. Run `make cli-publish-dry-run` and check the output (file list, version, `latest` tag).
2. From a clean checkout of a release tag, logged in to npm interactively (`npm login`, 2FA on), run `cd cli && yarn install --frozen-lockfile && npm publish`.
3. Register the trusted publisher, either on npmjs.com (package → Settings → Trusted Publisher → CircleCI) or with `npm trust circleci arcanum-cli --org-id <uuid> --project-id <uuid> --pipeline-definition-id <uuid> --vcs-origin github.com/darthjee/arcanum --allow-publish`. The IDs come from the CircleCI organization and project settings. `--context-id` is optional; only pass it if `publish-cli` is ever moved into that context, since the job would otherwise no longer match.
4. In the package's settings, set publishing access to require 2FA and disallow tokens, so only the trusted publisher (and interactive 2FA logins) can publish.

### Failure and recovery

- **Order.** `build-and-release` runs first, so a failed npm publish leaves a GitHub release with no matching CLI. That is the safe direction: arcanum installs work as before, and the CLI is optional.
- **Partial publish is impossible.** `npm publish` uploads one tarball in one request: the version either exists or it does not.
- **Auth failure before the bootstrap.** A release tagged before the bootstrap fails `publish-cli` at the publish step (npm `E404`/`E403`/`ENEEDAUTH`). Do the bootstrap, then use CircleCI's "Rerun workflow from failed". The same applies if the trusted-publisher entry is removed or no longer matches the job.
- **Registry lag.** The verify step polls the registry for up to five minutes after the publish. If the version is still not visible, it prints a "registry lag" warning and the job still succeeds, since `npm publish` already succeeded. Check the version later with `npm view arcanum-cli@X.Y.Z version`.
- **Re-runs are no-ops once published.** npm versions are immutable, so step 2 stops with success when the version already exists. That makes "Rerun workflow from failed" and whole-workflow re-runs safe. `build-and-release` is idempotent too.
- **A broken published version** is never unpublished (its version number could never be reused). Ship a new arcanum patch release, which publishes a new CLI version, and run `npm deprecate arcanum-cli@X.Y.Z "<reason>; upgrade to X.Y.Z+1"` by hand.
- **A lagging CLI.** While a publish is missing, the newest CLI on npm is the previous version. Users who already migrated to the new arcanum version see their tiers as ahead of the CLI, so reads warn and writes are refused without `--force`. That is the designed fail-safe, not a data risk, and it ends when the re-run publishes.

### Dist-tags

Every publish goes to `latest`; there is no pre-release channel. The `release` workflow only triggers on bare `X.Y.Z` tags, `publishConfig.tag` is pinned to `latest`, and the script's preflight rejects any tag that is not a bare `X.Y.Z`.

### Local tooling

The `cli` compose service and the root `Makefile`'s `cli-*` targets (owned by `infra`) run the CLI's tooling: `make cli-install`, `cli-lint`, `cli-build`, `cli-test` (which builds first, since the smoke specs need the bundle), `cli-check`, `cli-shell`, `cli-audit`, and `make cli-publish-dry-run`, which runs `scripts/publish_cli_package.sh <version> --dry-run`.

### Supply chain

What a user installs, and what can reach it:

- **Zero runtime dependencies.** `npm i -g arcanum-cli` installs exactly one package.
- **No install-time code:** no install lifecycle scripts, enforced by the manifest spec.
- **A readable bundle.** `dist/arcanum.mjs` is unminified.
- **Bounded build inputs.** The metafile check fails the build if anything outside `cli/lib/**` and `shared/lib/**` is bundled. The devDependencies, `esbuild` included, run only at build time, pinned to exact versions by `cli/yarn.lock` and installed with `--frozen-lockfile`.
- **Whitelisted contents.** `files` plus the `npm pack --dry-run` check mean no source, spec, lockfile or stray local file is published.
- **No long-lived credentials** (see [npm trusted publishing](#npm-trusted-publishing)).
- **Audit.** The `cli` CI job runs `yarn audit`, non-blocking, over the devDependencies.
- **No runtime network or install lookups.** The CLI never reads `arcanum/migrations/` or any network resource at runtime, and `cli/bin/arcanum` only imports the bundle next to it, by a relative path.

### Future work

- **A pre-release channel** (`X.Y.Z-rc.N` under the `next` dist-tag). It needs the `release` workflow to accept pre-release tags for the zip and the image too, which is a decision for the whole release pipeline, not the CLI alone.

### Alternatives considered

- **A release-zip tarball with its own `curl | bash` bootstrap,** or **a standalone binary** (`bun build --compile`, `pkg`). Rejected: arcanum would own PATH handling, updates and uninstall, or need per-OS builds, where npm already does the job.
- **Shipping the CLI inside each arcanum install, plus a PATH migration.** Rejected: several installs would mean several competing clients.
- **Publishing from GitHub Actions to get provenance.** GitHub Actions publishes get npm provenance; CircleCI publishes do not. Rejected anyway: it would split one release across two CI providers. The cost is no provenance; trusted publishing still removes long-lived tokens.
- **Publishing the CLI before the GitHub release.** Rejected: a CLI published for a release that then fails would describe a version that does not exist.
- **Publishing only when `cli/` or `shared/` changed.** Rejected: the CLI version would lag arcanum's, and the skew check would refuse writes to freshly migrated tiers.
- **Failing `publish-cli` when the version already exists,** like `publish-image`. Rejected: npm already guarantees immutability, so failing would only block whole-workflow re-runs.
- **Reading `arcanum/migrations/` at runtime.** Impossible: it is not in the npm package, and the CLI does not locate arcanum installs.

## Update

Complementing `install`, `arcanum/update/{bootstrap.sh,updater.sh}` brings an already-existing installation up to a newer release, reconciling the target directory: adds new files, replaces changed ones, and removes ones that dropped out of the release — without touching anything else in the directory. Same two-stage architecture as `install`:

1. **Bootstrap** (`arcanum/update/bootstrap.sh`) — can be invoked either via `curl | bash` (always fetches the newest logic) or directly from an already-existing installation (`bash <install-dir>/arcanum/update/bootstrap.sh`). Unlike `install/bootstrap.sh`, it has no default version embedded: when `ARCANUM_VERSION` is not set, it queries `GET https://api.github.com/repos/${ARCANUM_REPO}/releases/latest` (parsed with `grep`/`sed`, without `jq`, to keep this stage dependency-free) to resolve the latest published release. It also resolves `TARGET`, the default `REPO`, and the **install method** before downloading anything: if `${BASH_SOURCE[0]}` points to a real file already inside an installation (two directories up, `arcanum.json` or `.git` exists), it uses that directory as `TARGET`; `arcanum.json` present → zip-based install (flow below, unchanged), reads `repo` from `arcanum.json` as the `ARCANUM_REPO` default; `arcanum.json` absent but `.git` present → `git clone`-based install, reads the owner/repo from `git remote get-url origin` as the `ARCANUM_REPO` default instead of `arcanum.json` (same role, different source). With neither present, it falls back to `ARCANUM_TARGET` if set, or leaves `TARGET` empty for `updater.sh` to ask interactively (zip flow). Before touching the network or the target, it prints the resolved repo/version/method and requires explicit y/N confirmation read from `/dev/tty` (same pattern as the target-directory prompt in `installer.sh`/`updater.sh`) — skipped when `ARCANUM_ASSUME_YES` is set (any non-empty value), meant as a one-off command prefix, not to be exported permanently. It captures `ORIG_PWD="$(pwd)"` at the start and exports it alongside `REPO`/`VERSION`/`TARGET` before the `exec` into `updater.sh`, since `exec` replaces the process and `bootstrap.sh` itself can't restore the caller's cwd afterward.
2. **Updater** (`arcanum/update/updater.sh`) — ships inside the release zip; only reached by the zip flow (the git flow, below, never invokes `updater.sh`). Reads the existing `arcanum.json` on the target (old version/repo/manifest); if the version already matches the new one, it ends with an "already on X.Y.Z" message without touching anything. Otherwise, it acquires a concurrency lock via `mkdir "${TARGET}/.arcanum-update.lock"` (atomic — either the `mkdir` succeeds or the lock already exists) before touching the target; if it already exists, it fails fast, pointing out that the directory may need to be removed by hand if it's leftover from a previous run that got stuck. Only then: it copies the new tree over the target (`cp -R`, same as the installer), first removing every target file the release replaces so each copied file gets a new inode (a script still running from the install, such as `arcanum-update/scripts/run_update.sh`, keeps reading its old file instead of the new content at a stale offset), computes the removal set as the difference between the old `manifest` (from `arcanum.json`) and the new `MANIFEST` (embedded in the zip) — each candidate path for removal is validated before any `rm` (rejects an absolute path or one with a `..` segment; resolves the physical path via `cd`/`pwd` of the directory containing the file and confirms the result is still strictly inside the target) — and only then writes the new `arcanum.json`, last, which makes a mid-process failure safely re-runnable. The `trap ... EXIT` restores the caller's cwd (`cd "$ORIG_PWD"`, a safe no-op if `ORIG_PWD` isn't set — e.g. `updater.sh` called directly), releases the lock (`rmdir`), and finally cleans up its own working directory (unlike `install/bootstrap.sh`, which never cleans up its own, acceptable for a one-shot operation; `update` tends to run repeatedly).

Installations via `git clone` (with no `arcanum.json`) have their own flow inside `bootstrap.sh`, never going through `updater.sh`: before any `fetch`, it compares the resolved `VERSION` against the target's current tag (`git describe --tags --exact-match`) and exits early if already up to date; checks `git status --porcelain --untracked-files=no` and refuses to proceed (no auto-stash/auto-discard) if there are uncommitted changes to **tracked** files — untracked files (e.g. a host-written `synced/` folder) don't block the update, and `git checkout` still refuses to overwrite any untracked file it would clobber; confirms (same prompt mechanism above, with wording specific to the git method); and then runs `git fetch --tags --prune && git checkout <VERSION>` directly on the target, leaving it in detached HEAD at the resolved tag. It doesn't need the zip flow's concurrency lock — `git checkout`'s own internal lock files already make a second concurrent run fail cleanly.

`installer.sh` redirects to `update` instead of refusing with no alternative when an installation already exists — see above.

The `/arcanum-update` skill (`arcanum-update/SKILL.md` + `arcanum-update/scripts/run_update.sh`) exposes this flow from inside a Claude Code session, with no shell required: `run_update.sh check` resolves the method/repo/current version (same detection logic above, anchored to the skill's own on-disk location); the skill asks for confirmation in conversation before running `run_update.sh apply`, which sets `ARCANUM_ASSUME_YES=1` and runs `bootstrap.sh` directly, streaming its output live.
